import { GROUND } from '../Canvas.js';
import { drawParallax } from '../Layers.js';
import { drawStatic, glowAt, layerX, vgrad, type StageView } from '../Stage.js';
import { floorSeams } from './rooftop.js';

// Stalks are baked straight (no per-stalk sway); the whole layer sways instead (see drawBamboo).
function stalk(g: CanvasRenderingContext2D, x: number, w: number, body: string, node: string, hi: string | null, leaves: boolean, phase = 0): void {
  g.lineCap = 'round';
  g.strokeStyle = body; g.lineWidth = w;
  g.beginPath(); g.moveTo(x, GROUND); g.lineTo(x, -40); g.stroke();
  if (hi) { g.strokeStyle = hi; g.lineWidth = w * 0.25; g.beginPath(); g.moveTo(x - w * 0.22, GROUND); g.lineTo(x - w * 0.22, -40); g.stroke(); }
  g.strokeStyle = node; g.lineWidth = 1.5;
  g.beginPath();
  for (let y = GROUND - 40; y > -40; y -= 46) { g.moveTo(x - w * 0.6, y); g.lineTo(x + w * 0.6, y); }
  g.stroke();
  if (!leaves) return;
  g.fillStyle = node;
  for (let y = GROUND - 60 - phase; y > -20; y -= 92 + (phase & 31)) {
    for (const d of [-1, 1]) {
      g.beginPath(); g.moveTo(x, y);
      g.quadraticCurveTo(x + d * 14, y - 10, x + d * 30, y - 2);
      g.quadraticCurveTo(x + d * 14, y + 2, x, y); g.fill();
    }
  }
}

function sky(g: CanvasRenderingContext2D): void {
  g.fillStyle = vgrad(g, '#bfe8d0', '#95d5b2', -200, GROUND, '#e4f6e8'); g.fillRect(0, -200, 640, GROUND + 200);
}
function sunGlow(g: CanvasRenderingContext2D, ox: number): void {
  glowAt(g, ox - 150, 40, 170, 'rgba(255,250,215,0.95)', 'rgba(255,250,215,0)');
}
const RIDGE_COLORS = ['#a9d4bb', '#8fc4a5', '#76b18f'] as const;
const RIDGE_F = [0.2, 0.28, 0.36] as const;           // 0.2 * (1 + 0.4 k): each ridge keeps its own parallax
const RIDGE_KEYS = ['bam.ridge0', 'bam.ridge1', 'bam.ridge2'] as const;
const ridgePainters = RIDGE_COLORS.map((c, k) => (g: CanvasRenderingContext2D, ox: number, w: number): void => {
  g.fillStyle = c; g.beginPath(); g.moveTo(0, GROUND);
  for (let x = 0; x <= w; x += 16) {
    const wx = x - ox - 128 * k; // same phase as the original `x - fx*(1+0.4k)` with screen x = x - ox + fx
    g.lineTo(x, GROUND - 120 + k * 30 - 40 * Math.sin(wx / (90 + k * 30) + k) - 15 * Math.sin(wx / 37));
  }
  g.lineTo(w, GROUND); g.fill();
  g.fillStyle = 'rgba(240,255,245,0.35)'; g.fillRect(0, GROUND - 70 + k * 28, w, 26);
});
function farBamboo(g: CanvasRenderingContext2D, ox: number): void {
  for (let i = -20; i <= 20; i++) stalk(g, ox + i * 31 + ((i * 7) & 7), 4, '#8cc39a', '#79b088', null, false);
}
function midBamboo(g: CanvasRenderingContext2D, ox: number): void {
  for (let i = -16; i <= 16; i++) stalk(g, ox + i * 44 + ((i * 13) & 15), 9, '#4e8a4a', '#2f5e33', '#86c27a', true, (i * 37) & 63);
}
function front(g: CanvasRenderingContext2D, _ox: number, w: number): void {
  // Dojo edge: low wooden rail behind the floor, then polished planks with a sheen band (seams are per frame).
  g.fillStyle = '#5b3a1e'; g.fillRect(0, GROUND - 8, w, 8);
  g.fillStyle = '#7a5230'; g.fillRect(0, GROUND - 10, w, 3);
  g.fillStyle = vgrad(g, '#b88550', '#7a4f28', GROUND, 360); g.fillRect(0, GROUND, w, 40);
  g.strokeStyle = 'rgba(70,40,15,0.35)'; g.lineWidth = 1;
  g.beginPath(); for (let y = GROUND + 10; y < 360; y += 12) { g.moveTo(0, y); g.lineTo(w, y); } g.stroke();
  g.fillStyle = 'rgba(255,240,200,0.18)'; g.fillRect(0, GROUND + 3, w, 4);
}

/** Bao/Kaze home. Static art is cached; per frame: sun rays, layer sway, 10 falling leaves, floor seams (<= 25 primitives). */
export function drawBamboo(ctx: CanvasRenderingContext2D, v: StageView): void {
  drawStatic(ctx, 'bam.sky', -200, GROUND + 200, sky);
  drawParallax(ctx, 'bam.sun', 0.1, -130, 340, layerX(v, 0.1), sunGlow);
  // Rotating sun rays: 8 triangles as one path.
  const sx = layerX(v, 0.1) - 150, a0 = v.t / 2400;
  ctx.fillStyle = 'rgba(255,255,230,0.18)'; ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = a0 + (i + 1) * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    ctx.moveTo(sx, 40); ctx.lineTo(sx + 500 * c + 22 * s, 40 + 500 * s - 22 * c); ctx.lineTo(sx + 500 * c - 22 * s, 40 + 500 * s + 22 * c);
  }
  ctx.fill();
  for (let k = 0; k < 3; k++) drawParallax(ctx, RIDGE_KEYS[k]!, RIDGE_F[k]!, 140, 200, layerX(v, RIDGE_F[k]!), ridgePainters[k]!);
  drawParallax(ctx, 'bam.far', 0.35, -40, 360, layerX(v, 0.35) + 1.5 * Math.sin(v.t / 60), farBamboo);
  drawParallax(ctx, 'bam.mid', 0.5, -40, 360, layerX(v, 0.5) + 2 * Math.sin(v.t / 50), midBamboo);
  // Falling leaves (decoration only): rotated ellipses without save/restore.
  ctx.fillStyle = '#5f9e55'; ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const x = ((i * 113 + v.t * 0.4) % 720) - 40 + Math.sin(v.t / 25 + i) * 14;
    const y = ((i * 67 + v.t * (0.5 + (i & 3) * 0.15)) % 360) - 20;
    ctx.moveTo(x + 5, y); ctx.ellipse(x, y, 5, 1.8, Math.sin(v.t / 20 + i) * 1.2, 0, Math.PI * 2);
  }
  ctx.fill();
  drawParallax(ctx, 'bam.floor', 1.0, GROUND - 10, 50, layerX(v, 1.0), front);
  floorSeams(ctx, layerX(v, 1.0), 'rgba(70,40,15,0.45)', 70, 1.5);
}
