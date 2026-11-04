import { GROUND } from '../Canvas.js';
import { glowAt, layerX, vgrad, type StageView } from '../Stage.js';
import { floorSeams } from './rooftop.js';

function stalk(ctx: CanvasRenderingContext2D, x: number, sway: number, w: number, body: string, node: string, hi: string | null, leaves: boolean, t: number, phase = 0): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = body; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x + sway, -40); ctx.stroke();
  if (hi) { ctx.strokeStyle = hi; ctx.lineWidth = w * 0.25; ctx.beginPath(); ctx.moveTo(x - w * 0.22, GROUND); ctx.lineTo(x + sway - w * 0.22, -40); ctx.stroke(); }
  ctx.strokeStyle = node; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let y = GROUND - 40; y > -40; y -= 46) { const sx = x + sway * (GROUND - y) / (GROUND + 40); ctx.moveTo(sx - w * 0.6, y); ctx.lineTo(sx + w * 0.6, y); }
  ctx.stroke();
  if (!leaves) return;
  ctx.fillStyle = node;
  for (let y = GROUND - 60 - phase; y > -20; y -= 92 + (phase & 31)) {
    const sx = x + sway * (GROUND - y) / (GROUND + 40), flap = Math.sin(t / 40 + x) * 2;
    for (const d of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(sx, y);
      ctx.quadraticCurveTo(sx + d * 14, y - 10 + flap, sx + d * 30, y - 2 + flap);
      ctx.quadraticCurveTo(sx + d * 14, y + 2, sx, y); ctx.fill();
    }
  }
}

/** Bao/Kaze home: morning sky with sun rays, misty ridges, two bamboo depths, falling leaves, dojo planks. */
export function drawBamboo(ctx: CanvasRenderingContext2D, v: StageView): void {
  ctx.fillStyle = vgrad(ctx, '#bfe8d0', '#95d5b2', -200, GROUND, '#e4f6e8'); ctx.fillRect(0, -200, 640, GROUND + 200);
  // Morning sun with rays (parallax 0.1).
  const sx = layerX(v, 0.1) - 150;
  glowAt(ctx, sx, 40, 170, 'rgba(255,250,215,0.95)', 'rgba(255,250,215,0)');
  ctx.save(); ctx.translate(sx, 40);
  ctx.rotate(v.t / 2400);
  ctx.fillStyle = 'rgba(255,255,230,0.18)';
  for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(500, -22); ctx.lineTo(500, 22); ctx.fill(); }
  ctx.restore();
  // Far (0.2): 3 sine ridges with mist bands between them.
  const fx = layerX(v, 0.2);
  ['#a9d4bb', '#8fc4a5', '#76b18f'].forEach((c, k) => {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, GROUND);
    for (let x = 0; x <= 640; x += 16) {
      const wx = x - fx * (1 + k * 0.4);
      ctx.lineTo(x, GROUND - 120 + k * 30 - 40 * Math.sin(wx / (90 + k * 30) + k) - 15 * Math.sin(wx / 37));
    }
    ctx.lineTo(640, GROUND); ctx.fill();
    ctx.fillStyle = 'rgba(240,255,245,0.35)'; ctx.fillRect(0, GROUND - 70 + k * 28, 640, 26);
  });
  // Far bamboo (0.35): pale, thin, no leaves.
  const bx = layerX(v, 0.35);
  for (let i = -20; i <= 20; i++) {
    const x = bx + i * 31 + ((i * 7) & 7);
    if (x < -10 || x > 650) continue;
    stalk(ctx, x, Math.sin(v.t / 60 + i) * 1.5, 4, '#8cc39a', '#79b088', null, false, v.t);
  }
  // Mid (0.5): bamboo stalks with node lines, sway ±2 px, rim highlight and leaves.
  const mx = layerX(v, 0.5);
  for (let i = -16; i <= 16; i++) {
    const x = mx + i * 44 + ((i * 13) & 15);
    if (x < -20 || x > 660) continue;
    stalk(ctx, x, 2 * Math.sin(v.t / 50 + i), 9, '#4e8a4a', '#2f5e33', '#86c27a', true, v.t, (i * 37) & 63);
  }
  // Falling leaves (decoration only).
  ctx.fillStyle = '#5f9e55';
  for (let i = 0; i < 10; i++) {
    const x = ((i * 113 + v.t * 0.4) % 720) - 40 + Math.sin(v.t / 25 + i) * 14;
    const y = ((i * 67 + v.t * (0.5 + (i & 3) * 0.15)) % 360) - 20;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(v.t / 20 + i) * 1.2);
    ctx.beginPath(); ctx.ellipse(0, 0, 5, 1.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  // Dojo edge: low wooden rail behind the floor.
  ctx.fillStyle = '#5b3a1e'; ctx.fillRect(0, GROUND - 8, 640, 8);
  ctx.fillStyle = '#7a5230'; ctx.fillRect(0, GROUND - 10, 640, 3);
  // Floor (1.0): polished planks with converging seams and a sheen band.
  const nx = layerX(v, 1.0);
  ctx.fillStyle = vgrad(ctx, '#b88550', '#7a4f28', GROUND, 360); ctx.fillRect(0, GROUND, 640, 40);
  ctx.strokeStyle = 'rgba(70,40,15,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); for (let y = GROUND + 10; y < 360; y += 12) { ctx.moveTo(0, y); ctx.lineTo(640, y); } ctx.stroke();
  floorSeams(ctx, nx, 'rgba(70,40,15,0.45)', 70, 1.5);
  ctx.fillStyle = 'rgba(255,240,200,0.18)'; ctx.fillRect(0, GROUND + 3, 640, 4);
}
