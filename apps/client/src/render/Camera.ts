import { PX, STAGE_LEFT, STAGE_RIGHT, clamp, type MatchState } from '@kb/shared';
import { hash01 } from './Projectiles.js';

const CAM_Y_MAX = 40;
export const TRAUMA_ADD = [0.25, 0.45, 0.7] as const;
export const TRAUMA_DECAY = 0.05, SHAKE_PX = 6;
const PUNCH_FRAMES = 6, PUNCH_ZOOM = 0.04, KO_ZOOM = 0.15, KO_FRAMES = 90, KO_EASE = 20;

/** Camera follow + trauma shake + zoom. Render-only; the noise is a seeded hash of a local tick, never Math.random. */
export class Camera {
  x = 0;
  y = 0;
  shakeX = 0;
  shakeY = 0;
  /** Trauma 0..1; shake amplitude = trauma^2 * 6 px. */
  trauma = 0;
  /** Settings toggle "Screen shake" (default on). Trauma still decays when off. */
  shakeOn = true;
  /** Current zoom factor (1 = none) and its focus point in world px (y up). */
  zoom = 1;
  focusX = 0;
  focusY = 0;
  private punchLeft = 0;
  private koLeft = 0;
  private tick = 0;
  private lastEventFrame = -1;

  addTrauma(a: number): void { this.trauma = Math.min(1, this.trauma + a); }

  update(state: MatchState): void {
    const [a, b] = state.fighters;
    this.x = clamp((a.x + b.x) / (2 * PX), STAGE_LEFT / PX + 320, STAGE_RIGHT / PX - 320);
    // Follow the fighters' mid height; clamped so the ground line always stays on screen.
    const mid = (a.y + b.y) / (2 * PX);
    this.y += (clamp(mid - 60, 0, CAM_Y_MAX) - this.y) * 0.15;
    // Each sim frame's events count once, so a rolled-back replay cannot re-shake the screen.
    if (state.frame !== this.lastEventFrame) {
      this.lastEventFrame = state.frame;
      for (const e of state.events) {
        if (e.kind === 'super') this.addTrauma(0.6);
        else if (e.kind === 'hit' || e.kind === 'counter' || e.kind === 'throw') {
          this.addTrauma(TRAUMA_ADD[e.strength]);
          if (e.strength === 2) this.punchLeft = PUNCH_FRAMES;
        } else if (e.kind === 'block') this.addTrauma(0.12);
        else if (e.kind === 'ko') { this.addTrauma(0.8); this.koLeft = KO_FRAMES; this.focusX = e.x / PX; this.focusY = e.y / PX; }
      }
    }
    this.tick++;
    const amp = this.shakeOn ? this.trauma * this.trauma * SHAKE_PX : 0;
    this.shakeX = amp * (hash01(this.tick * 2 + 1) * 2 - 1);
    this.shakeY = amp * (hash01(this.tick * 2 + 2) * 2 - 1);
    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY);
    let z = 1;
    if (this.punchLeft > 0) { z += PUNCH_ZOOM * (this.punchLeft / PUNCH_FRAMES); this.punchLeft--; }
    if (this.koLeft > 0) {
      const k = Math.min(1, (KO_FRAMES - this.koLeft) / KO_EASE, this.koLeft / KO_EASE);
      z = Math.max(z, 1 + KO_ZOOM * k * k * (3 - 2 * k)); this.koLeft--;
    }
    this.zoom = z;
  }
}
