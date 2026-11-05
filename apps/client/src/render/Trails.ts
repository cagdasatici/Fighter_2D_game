/** Swing trails (FX slice). Fixed ring buffer per fighter: no allocation after construction. Render-only. */
export const TRAIL_POINTS = 6;

export class Trails {
  /** World px (y up), x/y interleaved, per fighter. */
  private readonly pts = [new Float32Array(TRAIL_POINTS * 2), new Float32Array(TRAIL_POINTS * 2)];
  private readonly head = [0, 0];
  private readonly len = [0, 0];

  count(i: 0 | 1): number { return this.len[i]!; }
  push(i: 0 | 1, x: number, y: number): void {
    const h = this.head[i]!, p = this.pts[i]!;
    p[h * 2] = x; p[h * 2 + 1] = y;
    this.head[i] = (h + 1) % TRAIL_POINTS;
    if (this.len[i]! < TRAIL_POINTS) this.len[i]!++;
  }
  /** Drop the oldest point (trail fades out once the move stops being active). */
  decay(i: 0 | 1): void { if (this.len[i]! > 0) this.len[i]!--; }
  clear(i: 0 | 1): void { this.len[i] = 0; }

  /** Tapering quad strip, newest point first, alpha 0.6 -> 0. `sx/sy` map world px to screen. */
  draw(ctx: CanvasRenderingContext2D, i: 0 | 1, color: string, sx: (x: number) => number, sy: (y: number) => number): void {
    const n = this.len[i]!;
    if (n < 2) return;
    const p = this.pts[i]!, h = this.head[i]!;
    ctx.fillStyle = color;
    for (let k = 0; k < n - 1; k++) {
      const a = (h - 1 - k + TRAIL_POINTS * 2) % TRAIL_POINTS, b = (a - 1 + TRAIL_POINTS) % TRAIL_POINTS;
      const ax = sx(p[a * 2]!), ay = sy(p[a * 2 + 1]!), bx = sx(p[b * 2]!), by = sy(p[b * 2 + 1]!);
      const wa = 6 * (1 - k / (n - 1)), wb = 6 * (1 - (k + 1) / (n - 1));
      ctx.globalAlpha = 0.6 * (1 - k / (n - 1));
      ctx.beginPath(); ctx.moveTo(ax, ay - wa); ctx.lineTo(bx, by - wb); ctx.lineTo(bx, by + wb); ctx.lineTo(ax, ay + wa); ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
