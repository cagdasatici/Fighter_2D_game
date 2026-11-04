import { describe, expect, test } from 'vitest';
import { cloneState, createMatch } from '../../packages/shared/src/index.js';
import { AudioBus, DEFAULT_MUSIC_VOLUME, type AudioContextLike } from '../../apps/client/src/audio/AudioBus.js';
import { RECIPES, MAX_VOICES, attenuation } from '../../apps/client/src/audio/synth.js';
import { STAGE_THEMES, loopSeconds, renderStageLoop } from '../../apps/client/src/audio/music.js';
import { cuesForFrame, cueForEvent } from '../../apps/client/src/audio/sfx.js';

function fakeCtx() {
  const st = { time: 0, started: 0, stopped: 0, closed: false, compressors: 0, buffers: 0, state: 'running' as string };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {}, disconnect() {} });
  const ctx: AudioContextLike = {
    get currentTime() { return st.time; },
    get state() { return st.state; },
    sampleRate: 8000, destination: {},
    resume: async () => {}, close: async () => { st.closed = true; },
    createOscillator: () => ({ ...node(), type: '', frequency: param(), start() { st.started++; }, stop() { st.stopped++; } }),
    createBufferSource: () => ({ ...node(), buffer: null, loop: false, start() { st.started++; }, stop() { st.stopped++; } }),
    createBuffer: (_c: number, len: number) => { st.buffers++; const d = new Float32Array(len); return { getChannelData: () => d }; },
    createBiquadFilter: () => ({ ...node(), type: '', frequency: param(), Q: param() }),
    createGain: () => ({ ...node(), gain: param() }),
    createDynamicsCompressor: () => { st.compressors++; return { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; },
  };
  return { ctx, st };
}
const mk = () => { const f = fakeCtx(); return { ...f, bus: new AudioBus(() => f.ctx) }; };

describe('AudioBus (adapted, decision 0006)', () => {
  test('silent before unlock; unlock is idempotent', () => {
    const t = mk();
    expect(t.bus.play('hitL', 0, 0)).toBe(false);
    t.bus.unlock(); t.bus.unlock();
    expect(t.st.compressors).toBe(1);
    expect(t.bus.play('hitL', 0, 0)).toBe(true);
  });
  test('voice cap 16 with priority stealing', () => {
    const t = mk(); t.bus.unlock();
    for (let i = 0; i < 40; i++) t.bus.play('ko', 1, 0);
    expect(t.bus.activeVoices).toBe(MAX_VOICES);
    expect(t.bus.play('whiff', 2, 0)).toBe(false);
    expect(t.bus.play('hitH', 0, 0)).toBe(true);
    expect(t.bus.activeVoices).toBe(MAX_VOICES);
  });
  test('music: default 0.25, starts after unlock for the set stage, switches, toggles, volume 0 stops', () => {
    const t = mk();
    expect(t.bus.musicVolumeValue).toBe(DEFAULT_MUSIC_VOLUME);
    expect(DEFAULT_MUSIC_VOLUME).toBe(0.25);
    t.bus.setStage('rooftop');
    expect(t.bus.musicPlaying).toBe(false);
    t.bus.unlock();
    expect(t.bus.musicPlaying).toBe(true);
    const stops = t.st.stopped;
    t.bus.setStage('volcano');
    expect(t.st.stopped).toBe(stops + 1);
    expect(t.bus.musicPlaying).toBe(true);
    expect(t.bus.currentStage).toBe('volcano');
    t.bus.setStage('volcano');
    expect(t.bus.loopCount).toBe(1);
    t.bus.setMusicEnabled(false); expect(t.bus.musicPlaying).toBe(false);
    t.bus.setMusicEnabled(true); expect(t.bus.musicPlaying).toBe(true);
    t.bus.setMusicVolume(0); expect(t.bus.musicPlaying).toBe(false);
    t.bus.setMusicVolume(0.5); expect(t.bus.musicPlaying).toBe(true);
    t.bus.setStage(null); expect(t.bus.musicPlaying).toBe(false);
  });
  test('suspend silences loops and blocks sounds until resume', () => {
    const t = mk(); t.bus.unlock(); t.bus.setStage('bamboo');
    t.bus.suspend();
    expect(t.bus.musicPlaying).toBe(false);
    expect(t.bus.play('hitL', 0, 0)).toBe(false);
    t.bus.resume();
    expect(t.bus.play('hitL', 0, 0)).toBe(true);
  });
  test('dispose stops voices and closes the context', () => {
    const t = mk(); t.bus.unlock(); t.bus.setStage('rooftop'); t.bus.play('super', 0, 0);
    t.bus.dispose();
    expect(t.st.closed).toBe(true);
    expect(t.bus.isUnlocked).toBe(false);
    expect(t.bus.activeVoices).toBe(0);
    expect(t.bus.play('hitL', 0, 0)).toBe(false);
  });
  test('attenuation unchanged', () => { expect(attenuation(0)).toBe(1); expect(attenuation(22.5)).toBe(0.5); expect(attenuation(45)).toBe(0); });
});

describe('spec §13 recipes', () => {
  test('hit L/M/H noise length, lowpass and thump', () => {
    const exp = [['hitL', 0.03, 2500, 180], ['hitM', 0.05, 1800, 140], ['hitH', 0.08, 1200, 90]] as const;
    for (const [k, dur, lp, hz] of exp) {
      const [n, o] = RECIPES[k].layers;
      expect(n).toMatchObject({ src: 'noise', filter: 'lowpass', f0: lp, dur });
      expect(o).toMatchObject({ src: 'osc', wave: 'sine', f0: hz });
    }
  });
  test('block, whiff, jump, land, super, ko, projectiles', () => {
    expect(RECIPES.block.layers[0]).toMatchObject({ wave: 'square', f0: 900, dur: 0.025 });
    expect(RECIPES.block.layers[1]).toMatchObject({ filter: 'highpass', f0: 3000, dur: 0.02 });
    expect(RECIPES.whiff.layers[0]).toMatchObject({ filter: 'bandpass', f0: 1500, f1: 600, dur: 0.09 });
    expect(RECIPES.jump.layers[0]).toMatchObject({ wave: 'sine', f0: 300, f1: 500, dur: 0.06 });
    expect(RECIPES.land.layers[0]).toMatchObject({ filter: 'lowpass', f0: 400, dur: 0.04 });
    expect(RECIPES.super.layers[0]).toMatchObject({ wave: 'sawtooth', f0: 200, f1: 1200, dur: 0.4 });
    expect(RECIPES.super.dur).toBeGreaterThan(0.4);
    expect(RECIPES.ko.layers.map((l) => l.f0)).toEqual([60, 880, 440]);
    expect(RECIPES.ko.layers[0]!.dur).toBe(0.6);
    expect(RECIPES.projRivet.layers.map((l) => l.wave)).toEqual(['square', 'square']);
    expect(RECIPES.projSpark.layers[0]).toMatchObject({ wave: 'sawtooth', f0: 2000, crackleHz: 40 });
    expect(RECIPES.projEgg.layers[0]).toMatchObject({ f0: 600, f1: 200 });
    expect(RECIPES.projShuriken.layers[0]!.src).toBe('noise');
    expect(RECIPES.projJade.layers.map((l) => l.f0)).toEqual([523, 659, 784]);
  });
});

describe('stage music', () => {
  test('one deterministic four-bar loop per stage, bounded', () => {
    for (const s of ['rooftop', 'bamboo', 'volcano'] as const) {
      expect(STAGE_THEMES[s].bass).toHaveLength(32);
      const a = renderStageLoop(s, 4000), b = renderStageLoop(s, 4000);
      expect(a.length).toBe(Math.floor(loopSeconds(s) * 4000));
      expect(a).toEqual(b);
      let peak = 0; for (const v of a) peak = Math.max(peak, Math.abs(v));
      expect(peak).toBeGreaterThan(0.05); expect(peak).toBeLessThan(1);
    }
    expect(renderStageLoop('rooftop', 4000)).not.toEqual(renderStageLoop('volcano', 4000).slice(0, renderStageLoop('rooftop', 4000).length));
  });
});

describe('sfx mapping', () => {
  test('events map to recipes by strength', () => {
    const e = { frame: 1, x: 0, y: 0, by: 0 as const };
    expect(cueForEvent({ ...e, kind: 'hit', strength: 0 })?.kind).toBe('hitL');
    expect(cueForEvent({ ...e, kind: 'counter', strength: 2 })?.kind).toBe('hitH');
    expect(cueForEvent({ ...e, kind: 'ko', strength: 2 })?.kind).toBe('ko');
    expect(cueForEvent({ ...e, kind: 'block', strength: 1 })?.kind).toBe('block');
  });
  test('derived jump and new-projectile cues', () => {
    const prev = createMatch({ chars: ['bolt', 'volt'], stage: 'rooftop', seed: 1 });
    const cur = cloneState(prev);
    prev.fighters[0].state = 'jumpSquat'; cur.fighters[0].state = 'air';
    cur.projectiles.push({ owner: 1, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0, gravity: 0, w: 1, h: 1, hits: 1, hitInterval: 0, cooldown: 0, life: 1, def: 'x', exploding: 0 });
    const kinds = cuesForFrame(prev, cur).map((c) => c.kind);
    expect(kinds).toEqual(['jump', 'projSpark']);
    expect(cuesForFrame(cur, cloneState(cur))).toEqual([]);
  });
});
