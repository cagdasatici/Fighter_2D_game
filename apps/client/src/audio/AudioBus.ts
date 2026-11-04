import type { StageId } from "@kb/shared";
import { renderStageLoop } from "./music.js";
import { attenuation, MAX_VOICES, RECIPES, type Priority, type Recipe, type SoundKind } from "./synth.js";

/** Spec §13 default music volume. */
export const DEFAULT_MUSIC_VOLUME = 0.25;

/** Structural subset of the WebAudio API used here, so tests can pass a fake context. */
export interface ParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
}
export interface NodeLike { connect(n: unknown): unknown; disconnect(): void }
export interface SourceLike extends NodeLike { start(t?: number): void; stop(t?: number): void }
export interface OscLike extends SourceLike { type: string; frequency: ParamLike }
export interface NoiseLike extends SourceLike { buffer: unknown; loop: boolean }
export interface FilterLike extends NodeLike { type: string; frequency: ParamLike; Q: ParamLike }
export interface GainLike extends NodeLike { gain: ParamLike }
export interface CompressorLike extends NodeLike {
  threshold: ParamLike; knee: ParamLike; ratio: ParamLike; attack: ParamLike; release: ParamLike;
}
export interface BufferLike { getChannelData(c: number): Float32Array }
export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: unknown;
  resume(): Promise<void>;
  close(): Promise<void>;
  createOscillator(): OscLike;
  createBufferSource(): NoiseLike;
  createBuffer(ch: number, len: number, rate: number): BufferLike;
  createBiquadFilter(): FilterLike;
  createGain(): GainLike;
  createDynamicsCompressor(): CompressorLike;
  /** QS01: optional so fakes stay small. Real contexts report "running", "suspended", "closed" or (Safari) "interrupted". */
  readonly state?: string;
  suspend?(): Promise<void>;
  onstatechange?: (() => void) | null;
}

interface Voice { priority: Priority; start: number; end: number; stop: () => void; loopKey?: string; out?: GainLike }

/**
 * Master bus: one compressor, effects gain from settings, a 16 voice cap with priority stealing and linear
 * distance attenuation. Silent until unlock() succeeds. Presentation only.
 * Adapted from battlegrounds (decision 0006): Knockout Bash sound keys and one procedural loop per stage.
 */
export class AudioBus {
  private ctx: AudioContextLike | null = null;
  private master: GainLike | null = null;
  private mix: NodeLike | null = null;
  private music: GainLike | null = null;
  private readonly musicBuffers = new Map<StageId, BufferLike>();
  private musicVolume = DEFAULT_MUSIC_VOLUME;
  private musicOn = true;
  private stage: StageId | null = null;
  private noise: BufferLike | null = null;
  private voices: Voice[] = [];
  private unlocked = false;
  private suspended = false;
  private effects = 1;

  constructor(private readonly make: () => AudioContextLike) {}

  get isUnlocked(): boolean { return this.unlocked; }
  get activeVoices(): number { this.prune(); return this.voices.length; }

  /** Must be called from a user gesture (the Play press). Idempotent. */
  unlock(): void {
    if (this.unlocked) return;
    try {
      const ctx = this.make();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 6; comp.attack.value = 0.003; comp.release.value = 0.25;
      const master = ctx.createGain();
      master.gain.value = this.effects;
      master.connect(comp);
      comp.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.5);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let s = 12345; // deterministic xorshift noise
      for (let i = 0; i < len; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; d[i] = ((s >>> 0) / 0xffffffff) * 2 - 1; }
      this.mix = comp;
      this.ctx = ctx; this.master = master; this.noise = buf; this.unlocked = true;
      void ctx.resume().then(() => this.syncMusic()).catch(() => {});
      ctx.onstatechange = () => {
        if (ctx.state !== undefined && ctx.state !== "running") this.stopAllLoops();
        else this.syncMusic();
      };
      this.syncMusic();
    } catch { this.unlocked = false; }
  }

  /** Effects slider, 0..1. */
  setEffectsVolume(v: number): void {
    this.effects = Math.min(1, Math.max(0, v));
    if (this.master) this.master.gain.value = this.effects;
  }

  get musicVolumeValue(): number { return this.musicVolume; }
  get musicEnabled(): boolean { return this.musicOn; }
  get currentStage(): StageId | null { return this.stage; }

  /** Music slider, 0..1, independent of effects volume. 0 stops the loop. */
  setMusicVolume(value: number): void {
    this.musicVolume = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
    if (this.music) this.music.gain.value = this.musicVolume;
    this.syncMusic();
  }

  /** Settings toggle (S11 UI). */
  setMusicEnabled(on: boolean): void { this.musicOn = on; this.syncMusic(); }

  /** Stage whose loop should play, or null for silence (menus). Switching stages restarts the loop. */
  setStage(stage: StageId | null): void {
    if (stage === this.stage) { this.syncMusic(); return; }
    this.stopLoop("__music");
    this.stage = stage;
    this.syncMusic();
  }

  /** Start the current stage loop when allowed; stop it when not. One low-priority voice. */
  private syncMusic(): void {
    const ctx = this.ctx, stage = this.stage;
    if (!stage || !this.musicOn || this.musicVolume === 0) { this.stopLoop("__music"); return; }
    if (!ctx || !this.mix || this.isSuspended || this.hasLoop("__music")) return;
    this.prune();
    if (this.voices.length >= MAX_VOICES) return;
    let buf = this.musicBuffers.get(stage);
    if (!buf) {
      const rate = 16000, data = renderStageLoop(stage, rate);
      buf = ctx.createBuffer(1, data.length, rate);
      buf.getChannelData(0).set(data);
      this.musicBuffers.set(stage, buf);
    }
    const out = ctx.createGain(); out.gain.value = this.musicVolume; out.connect(this.mix); this.music = out;
    const source = ctx.createBufferSource(); source.buffer = buf; source.loop = true; source.connect(out); source.start();
    this.voices.push({ priority: 2, start: ctx.currentTime, end: Infinity, loopKey: "__music", out,
      stop: () => { try { source.stop(); } catch { /* already stopped */ } source.disconnect(); out.disconnect(); if (this.music === out) this.music = null; } });
  }

  get musicPlaying(): boolean { return this.hasLoop("__music"); }

  /** Returns true when a voice was started. distM is listener-to-source distance in metres. */
  play(kind: SoundKind, priority: Priority, distM: number): boolean {
    const ctx = this.ctx, master = this.master;
    if (!this.unlocked || !ctx || !master || this.isSuspended) return false;
    const att = attenuation(distM);
    if (att <= 0) return false;
    this.prune();
    if (this.voices.length >= MAX_VOICES && !this.steal(priority)) return false;
    const recipe = RECIPES[kind];
    const t0 = ctx.currentTime;
    const { stop } = this.build(ctx, master, recipe, att);
    this.voices.push({ priority, start: t0, end: t0 + recipe.dur + 0.02, stop });
    return true;
  }

  stopLoop(key: string): void {
    const v = this.voices.find((x) => x.loopKey === key);
    if (!v) return;
    v.stop();
    this.voices = this.voices.filter((x) => x !== v);
  }

  hasLoop(key: string): boolean { return this.voices.some((v) => v.loopKey === key); }
  get loopCount(): number { return this.voices.filter((v) => v.loopKey !== undefined).length; }

  stopAllLoops(): void {
    for (const v of this.voices) if (v.loopKey !== undefined) v.stop();
    this.voices = this.voices.filter((v) => v.loopKey === undefined);
  }

  /** Page hidden or device interruption: silence every loop and refuse new ones until resume(). One-shots finish on their own. */
  suspend(): void {
    this.suspended = true;
    this.stopAllLoops();
    void this.ctx?.suspend?.().catch(() => {});
  }

  resume(): void {
    this.suspended = false;
    const ctx = this.ctx;
    if (ctx) void ctx.resume().then(() => this.syncMusic()).catch(() => {});
  }

  /** Safari can leave a context suspended after creation; call on each gesture until it runs. True once running. */
  ensureRunning(): boolean {
    const ctx = this.ctx;
    if (!this.unlocked || !ctx) return false;
    if (ctx.state === undefined || ctx.state === "running") return true;
    if (!this.suspended) void ctx.resume().catch(() => {});
    return false;
  }

  get isSuspended(): boolean { return this.suspended || (this.ctx?.state !== undefined && this.ctx.state !== "running"); }

  /** Free a voice slot for a newcomer of `priority`; false when everything outranks it. */
  private steal(priority: Priority): boolean {
    let victim = this.voices[0]!;
    for (const v of this.voices) if (v.priority > victim.priority || (v.priority === victim.priority && v.start < victim.start)) victim = v;
    if (victim.priority < priority) return false;
    victim.stop();
    this.voices = this.voices.filter((v) => v !== victim);
    return true;
  }

  private build(ctx: AudioContextLike, master: GainLike, recipe: Recipe, att: number): { out: GainLike; stop: () => void } {
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = att;
    out.connect(master);
    const srcs: SourceLike[] = [];
    for (const l of recipe.layers) {
      const at = t0 + (l.delay ?? 0), end = at + l.dur;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, at);
      env.gain.linearRampToValueAtTime(l.gain, at + l.attack);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      let head: NodeLike;
      let src: SourceLike;
      if (l.src === "osc") {
        const o = ctx.createOscillator();
        o.type = l.wave ?? "sine";
        o.frequency.setValueAtTime(l.f0, at);
        o.frequency.exponentialRampToValueAtTime(l.f1, end);
        src = o; head = o;
      } else {
        const n = ctx.createBufferSource();
        n.buffer = this.noise; n.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = l.filter ?? "lowpass";
        f.frequency.setValueAtTime(l.f0, at);
        f.frequency.exponentialRampToValueAtTime(l.f1, end);
        f.Q.value = 1;
        n.connect(f);
        src = n; head = f;
      }
      head.connect(env);
      if (l.crackleHz !== undefined) {
        const lfo = ctx.createOscillator();
        lfo.type = "square";
        lfo.frequency.setValueAtTime(l.crackleHz, at);
        const depth = ctx.createGain();
        depth.gain.value = l.gain * 0.5;
        lfo.connect(depth); depth.connect(env.gain);
        lfo.start(at); lfo.stop(end + 0.02); srcs.push(lfo);
      }
      env.connect(out);
      src.start(at); src.stop(end + 0.02);
      srcs.push(src);
    }
    return { out, stop: () => { for (const s of srcs) { try { s.stop(); s.disconnect(); } catch { /* already stopped */ } } out.disconnect(); } };
  }

  private prune(): void {
    const now = this.ctx?.currentTime ?? 0;
    this.voices = this.voices.filter((v) => v.end > now);
  }

  dispose(): void {
    for (const v of this.voices) v.stop();
    this.voices = [];
    this.master?.disconnect(); this.mix?.disconnect();
    this.mix = null; this.music = null; this.musicBuffers.clear(); this.stage = null;
    const c = this.ctx;
    if (c) c.onstatechange = null;
    this.ctx = null; this.master = null; this.unlocked = false;
    void c?.close().catch(() => {});
  }
}
