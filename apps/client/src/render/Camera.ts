import { PX, STAGE_LEFT, STAGE_RIGHT, clamp, type MatchState } from '@kb/shared';

export class Camera {
  x = 0;
  y = 0;
  shakeX = 0;
  shakeY = 0;
  private shakeLeft = 0;
  private amplitude = 0;
  update(state: MatchState): void {
    const [a, b] = state.fighters;
    this.x = clamp((a.x + b.x) / (2 * PX), STAGE_LEFT / PX + 320, STAGE_RIGHT / PX - 320);
    this.y += (Math.max(0, Math.max(a.y, b.y) / PX - 140) - this.y) * 0.15;
    for (const event of state.events) {
      if (event.kind === 'super') { this.amplitude = 6; this.shakeLeft = 12; }
      else if ((event.kind === 'hit' || event.kind === 'counter') && event.strength === 2) {
        this.amplitude = 4; this.shakeLeft = 8;
      }
    }
    this.shakeX = this.shakeLeft > 0 ? (this.shakeLeft % 2 ? 1 : -1) * this.amplitude : 0;
    this.shakeY = this.shakeLeft > 0 ? (this.shakeLeft % 3 - 1) * this.amplitude / 2 : 0;
    if (this.shakeLeft > 0) this.shakeLeft--;
  }
}
