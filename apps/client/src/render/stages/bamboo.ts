import { GROUND } from '../Canvas.js';
import { layerX, vgrad, type StageView } from '../Stage.js';

/** Bao/Kaze home: morning sky, misty sine ridges, swaying bamboo, dojo planks. */
export function drawBamboo(ctx: CanvasRenderingContext2D, v: StageView): void {
  ctx.fillStyle = '#d8f3dc'; ctx.fillRect(0, -200, 640, 200);
  ctx.fillStyle = vgrad(ctx, '#d8f3dc', '#95d5b2'); ctx.fillRect(0, 0, 640, GROUND);
  // Far (0.2): 3 sine-ridge polygons.
  const fx = layerX(v, 0.2);
  ['#b7dcc4', '#9fcfb1', '#86c09d'].forEach((c, k) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, GROUND);
    for (let x = 0; x <= 640; x += 16) {
      const wx = x - fx;
      ctx.lineTo(x, GROUND - 120 + k * 30 - 40 * Math.sin(wx / (90 + k * 30) + k) - 15 * Math.sin(wx / 37));
    }
    ctx.lineTo(640, GROUND); ctx.fill();
  });
  // Mid (0.5): bamboo stalks with node lines, sway ±2 px.
  const mx = layerX(v, 0.5);
  for (let i = -16; i <= 16; i++) {
    const x = mx + i * 44 + ((i * 13) & 15), sway = 2 * Math.sin(v.t / 50 + i);
    if (x < -20 || x > 660) continue;
    ctx.strokeStyle = '#4e8a4a'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x + sway, -40); ctx.stroke();
    ctx.strokeStyle = '#2f5e33'; ctx.lineWidth = 1.5;
    for (let y = GROUND - 40; y > -40; y -= 46) {
      const sx = x + sway * (GROUND - y) / (GROUND + 40);
      ctx.beginPath(); ctx.moveTo(sx - 5, y); ctx.lineTo(sx + 5, y); ctx.stroke();
    }
  }
  // Near (1.0) + floor: wooden dojo planks.
  const nx = layerX(v, 1.0);
  ctx.fillStyle = '#a0703f'; ctx.fillRect(0, GROUND, 640, 60);
  ctx.strokeStyle = '#6e4a27'; ctx.lineWidth = 1;
  for (let y = GROUND + 10; y < 360; y += 12) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(640, y); ctx.stroke(); }
  for (let i = -20; i <= 20; i++) {
    const x = nx + i * 70; if (x < 0 || x > 640) continue;
    const row = (i & 3) * 12;
    ctx.beginPath(); ctx.moveTo(x, GROUND + row); ctx.lineTo(x, GROUND + row + 12); ctx.stroke();
  }
}
