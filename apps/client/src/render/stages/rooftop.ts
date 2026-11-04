import { GROUND } from '../Canvas.js';
import { layerX, vgrad, type StageView } from '../Stage.js';

/** Bolt/Volt home: sunset sky, lit skyline, water tanks + crane, tar roof with helipad arc. */
export function drawRooftop(ctx: CanvasRenderingContext2D, v: StageView): void {
  ctx.fillStyle = vgrad(ctx, '#ff9a5a', '#5b3a7a'); ctx.fillRect(0, -200, 640, GROUND + 200);
  ctx.fillStyle = vgrad(ctx, '#ff9a5a', '#ff9a5a', -200, 0); ctx.fillRect(0, -200, 640, 200);
  // Far skyline (0.2): deterministic building heights and window pattern from index.
  const fx = layerX(v, 0.2);
  for (let i = -14; i <= 14; i++) {
    const w = 34 + (i * 7 & 15), h = 70 + ((i * 37) & 63), x = fx + i * 48 - w / 2;
    if (x > 660 || x + w < -20) continue;
    ctx.fillStyle = '#2b2140'; ctx.fillRect(x, GROUND - 40 - h, w, h + 40);
    ctx.fillStyle = '#ffd98a';
    for (let r = 0; r < h / 12 - 1; r++) for (let c = 0; c < w / 10 - 1; c++) {
      if (((i * 31 + r * 7 + c * 13) & 7) < 3) ctx.fillRect(x + 5 + c * 10, GROUND - 32 - h + r * 12, 4, 5);
    }
  }
  // Mid (0.5): water tanks and a crane silhouette.
  const mx = layerX(v, 0.5);
  ctx.fillStyle = '#1e1630';
  for (const tx of [-420, -120, 260, 520]) {
    const x = mx + tx;
    ctx.fillRect(x - 22, GROUND - 90, 44, 46);
    ctx.beginPath(); ctx.moveTo(x - 26, GROUND - 90); ctx.lineTo(x, GROUND - 108); ctx.lineTo(x + 26, GROUND - 90); ctx.fill();
    ctx.fillRect(x - 18, GROUND - 44, 4, 44); ctx.fillRect(x + 14, GROUND - 44, 4, 44);
  }
  const cx = mx + 60;
  ctx.fillRect(cx - 4, GROUND - 230, 8, 230);
  ctx.fillRect(cx - 80, GROUND - 230, 220, 6);
  ctx.strokeStyle = '#1e1630'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx + 120, GROUND - 224); ctx.lineTo(cx + 120, GROUND - 170); ctx.stroke();
  // Near (1.0) + floor: tar roof and helipad arc.
  const nx = layerX(v, 1.0);
  ctx.fillStyle = '#2a2a33'; ctx.fillRect(0, GROUND, 640, 60);
  ctx.fillStyle = '#3a3a46'; ctx.fillRect(0, GROUND, 640, 4);
  ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(nx, GROUND + 22, 150, 16, 0, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
  ctx.font = 'bold 18px system-ui'; ctx.fillStyle = '#f2f2f2'; ctx.textAlign = 'center'; ctx.fillText('H', nx, GROUND + 30);
}
