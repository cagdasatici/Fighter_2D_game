import { PLATFORMS, PX, type StageId } from '@kb/shared';
import { GROUND } from '../Canvas.js';
import type { StageView } from '../Stage.js';

const THICK = 9;

/** One-way platform slabs, drawn between the stage and the fighters. Few rects per slab, no allocation. */
export function drawPlatforms(ctx: CanvasRenderingContext2D, stage: StageId, v: StageView): void {
  for (const p of PLATFORMS[stage]) {
    const x = 320 + p.x0 / PX - v.camX, w = (p.x1 - p.x0) / PX, y = GROUND - p.y / PX + v.camY;
    if (x > 640 || x + w < 0) continue;
    if (stage === 'rooftop') {
      ctx.fillStyle = '#4a4f66'; ctx.fillRect(x, y, w, THICK);          // steel beam
      ctx.fillStyle = '#2c2f42'; ctx.fillRect(x, y + THICK - 3, w, 3);
      ctx.fillStyle = '#9aa3c4'; ctx.fillRect(x, y, w, 1.5);
      ctx.fillStyle = '#20233a';
      for (let rx = x + 6; rx < x + w - 3; rx += 14) ctx.fillRect(rx, y + 3, 2, 2); // rivets
    } else if (stage === 'bamboo') {
      ctx.fillStyle = '#b79a4e'; ctx.fillRect(x, y, w, THICK);          // lashed bamboo poles
      ctx.fillStyle = '#7b5f2a'; ctx.fillRect(x, y + 4, w, 1);
      ctx.fillStyle = '#e6d28a'; ctx.fillRect(x, y, w, 1.5);
      ctx.fillStyle = '#4c3a1c';
      for (let lx = x + 10; lx < x + w - 4; lx += 36) ctx.fillRect(lx, y - 1, 4, THICK + 2); // rope lashings
    } else {
      ctx.fillStyle = '#2b2326'; ctx.fillRect(x, y, w, THICK);          // basalt ledge
      ctx.fillStyle = 'rgba(255,110,40,0.55)'; ctx.fillRect(x + 2, y + THICK - 2, w - 4, 2);
      ctx.fillStyle = '#6b5a58'; ctx.fillRect(x, y, w, 1.5);
      ctx.fillStyle = '#1a1416';
      for (let cx = x + 8; cx < x + w - 6; cx += 22) ctx.fillRect(cx, y + 2, 1, 5);
    }
  }
}
