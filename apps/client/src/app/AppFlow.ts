import { CHARS, METER_MAX, PX, cloneState, createMatch, getMove, step, type Fighter, type InputByte, type MatchState } from '@kb/shared';
import { Keyboard } from '../input/Keyboard.js';
import { Canvas } from '../render/Canvas.js';
import { Camera } from '../render/Camera.js';
import { GROUND } from '../render/Canvas.js';
import { drawDebug } from '../render/DebugDraw.js';
import { Fx } from '../render/Fx.js';
import { Hud } from '../render/Hud.js';
import { SKINS } from '../render/Gallery.js';
import { drawPuppet } from '../render/Puppet.js';
import { drawStage } from '../render/Stage.js';
import { clipFor, poseOf } from '../render/clips.js';
import { GameLoop } from './GameLoop.js';
import { AudioBus, type AudioContextLike } from '../audio/AudioBus.js';
import { cuesForFrame } from '../audio/sfx.js';

declare global {
  interface Window { __kb?: { state: MatchState; step: (inputs?: [InputByte, InputByte]) => void } }
}

/** S8 enters local 2P directly; menu routing is added by S11. */
export class AppFlow {
  readonly state = createMatch({ chars: ['bolt', 'volt'], stage: 'rooftop', seed: 1 });
  private previous = cloneState(this.state);
  private readonly canvas: Canvas;
  private readonly camera = new Camera();
  private readonly keyboard: Keyboard;
  private readonly loop: GameLoop;
  private boxes = false;
  private readonly fx = new Fx(by => CHARS[this.state.fighters[by].char].name, by => SKINS[this.state.fighters[by].char].accent);
  private readonly hud = new Hud(this.state);
  private renderTick = 0;
  private readonly audio = new AudioBus(() => new AudioContext() as unknown as AudioContextLike);
  private readonly unlockAudio = (): void => {
    this.audio.unlock();
    if (this.audio.ensureRunning()) this.removeGestureListeners();
  };
  private readonly onVisibility = (): void => { if (document.hidden) this.audio.suspend(); else this.audio.resume(); };
  constructor(element: HTMLCanvasElement) {
    this.canvas = new Canvas(element);
    this.keyboard = new Keyboard(() => { this.boxes = !this.boxes; });
    this.loop = new GameLoop(() => this.advance(this.keyboard.read()), alpha => {
      const ctx = this.canvas.begin();
      if (this.boxes) drawDebug(ctx, this.state, this.previous, alpha, this.camera, true);
      else this.drawScene(ctx, alpha);
    });
    window.addEventListener('pointerdown', this.unlockAudio);
    window.addEventListener('keydown', this.unlockAudio);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (import.meta.env.DEV) window.__kb = { state: this.state, step: (inputs = [0, 0]) => this.advance(inputs) };
    this.loop.start();
  }
  private advance(inputs: [InputByte, InputByte]): void {
    this.previous = cloneState(this.state);
    step(this.state, inputs);
    this.camera.update(this.state);
    // Exactly-once event consumption: Fx.lastFxFrame guards both FX and SFX (decision 0005).
    if (this.state.frame !== this.fx.lastFxFrame) for (const c of cuesForFrame(this.previous, this.state)) this.audio.play(c.kind, c.priority, 0);
    this.fx.consume(this.state); this.fx.update(); this.hud.update(this.state);
    this.audio.setStage(this.state.phase === 'matchEnd' ? null : this.state.stage);
  }
  private removeGestureListeners(): void {
    window.removeEventListener('pointerdown', this.unlockAudio);
    window.removeEventListener('keydown', this.unlockAudio);
  }
  private drawScene(ctx: CanvasRenderingContext2D, alpha: number): void {
    const cam = this.camera, s = this.state;
    const sx = (x: number): number => 320 + x - cam.x + cam.shakeX;
    const sy = (y: number): number => GROUND - y + cam.y + cam.shakeY;
    drawStage(ctx, s.stage, { camX: cam.x - cam.shakeX, camY: cam.y + cam.shakeY, t: this.renderTick++ });
    const drawFighter = (i: 0 | 1): void => {
      const f: Fighter = s.fighters[i], old = this.previous.fighters[i];
      const x = (old.x + (f.x - old.x) * alpha) / PX, y = (old.y + (f.y - old.y) * alpha) / PX;
      const move = f.state === 'attack' && f.move ? getMove(f.char, f.move) ?? null : null;
      const flash = (f.state === 'hitstun' || f.state === 'juggle') && f.stateFrame <= 2 ? 'hit' as const : null;
      drawPuppet(ctx, SKINS[f.char], poseOf(clipFor(f, move)), sx(x), sy(y), f.facing,
        { frame: s.frame, meterFull: f.meter >= METER_MAX, glow: f.meter >= METER_MAX, flash });
    };
    const superBy = this.fx.superLeft > 0 ? this.fx.superBy : null;
    for (const i of [0, 1] as const) if (i !== superBy) drawFighter(i);
    for (const p of s.projectiles) {
      ctx.fillStyle = SKINS[s.fighters[p.owner].char].accent; ctx.strokeStyle = '#1b1b2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx(p.x / PX), sy(p.y / PX), p.w / 2, p.h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    this.fx.drawDim(ctx);
    if (superBy !== null) drawFighter(superBy);
    this.fx.draw(ctx, sx, sy);
    this.hud.draw(ctx, s);
  }
  dispose(): void {
    this.loop.dispose(); this.keyboard.dispose(); this.canvas.dispose();
    this.removeGestureListeners();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.dispose();
    if (import.meta.env.DEV && window.__kb?.state === this.state) delete window.__kb;
  }
}
