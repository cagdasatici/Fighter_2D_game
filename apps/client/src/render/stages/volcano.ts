import { GROUND } from '../Canvas.js';
import { cacheLayer, drawParallax, getLayer, getLayerScale } from '../Layers.js';
import { drawStatic, glowAt, layerX, vgrad, type StageView } from '../Stage.js';
import { floorSeams } from './rooftop.js';

function sky(g: CanvasRenderingContext2D): void {
  g.fillStyle = vgrad(g, '#1e0710', '#b5381a', -200, GROUND, '#5a1418'); g.fillRect(0, -200, 640, GROUND + 200);
}
function mountain(g: CanvasRenderingContext2D, fx: number): void {
  glowAt(g, fx, 90, 140, 'rgba(255,150,60,0.55)', 'rgba(255,80,30,0)');
  g.fillStyle = '#2a0f0c'; g.beginPath(); g.moveTo(fx - 260, GROUND); g.lineTo(fx - 40, 90); g.lineTo(fx + 40, 90); g.lineTo(fx + 260, GROUND); g.fill();
  g.fillStyle = '#3d1712'; g.beginPath(); g.moveTo(fx + 40, 90); g.lineTo(fx + 260, GROUND); g.lineTo(fx + 120, GROUND); g.fill(); // lit flank
}
function streams(g: CanvasRenderingContext2D, fx: number): void {
  g.strokeStyle = 'rgba(255,150,40,0.9)'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(fx - 10, 92); g.quadraticCurveTo(fx - 30, 150, fx - 70, 210);
  g.moveTo(fx + 15, 92); g.quadraticCurveTo(fx + 30, 160, fx + 20, 230);
  g.stroke();
}
function ridge(g: CanvasRenderingContext2D, rx: number, w: number): void {
  g.fillStyle = '#1f0b0a'; g.beginPath(); g.moveTo(0, GROUND);
  for (let x = 0; x <= w; x += 20) g.lineTo(x, GROUND - 50 - 18 * Math.sin((x - rx) / 60) - 10 * Math.sin((x - rx) / 23));
  g.lineTo(w, GROUND); g.fill();
}
function ferns(g: CanvasRenderingContext2D, mx: number): void {
  g.lineCap = 'round';
  for (const base of [-480, -200, 140, 420]) {
    const bx = mx + base;
    for (let k = -3; k <= 3; k++) {
      const ex = bx + k * 50, ey = GROUND - 90 + Math.abs(k) * 12;
      g.strokeStyle = '#1d2a12'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(bx, GROUND);
      g.bezierCurveTo(bx + k * 10, GROUND - 80, bx + k * 30, GROUND - 120, ex, ey); g.stroke();
      // Leaflets: slim filled leaves along the outer half of each frond, angled towards its tip.
      g.fillStyle = '#1d2a12';
      const ang = Math.atan2(ey - (GROUND - 110), ex - bx);
      for (let j = 2; j <= 5; j++) {
        const tt = j / 6, px = bx + (ex - bx) * tt, py = GROUND - 100 * Math.sin(tt * 2.6) * (1 - tt * 0.15) + (ey - GROUND + 90) * tt;
        for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(px, py, 11 - j, 2.4, ang + sd * 0.9, 0, Math.PI * 2); g.fill(); }
      }
    }
  }
}
function floor(g: CanvasRenderingContext2D, _ox: number, w: number): void {
  g.fillStyle = vgrad(g, '#3a221a', '#160d0b', GROUND, 360); g.fillRect(0, GROUND, w, 40);
}

function cracks(g: CanvasRenderingContext2D, ox: number, w: number): void {
  g.lineJoin = 'round';
  for (const [lw, a] of [[6, 0.25], [2, 1]] as const) {
    g.strokeStyle = `rgba(255,150,40,${a})`; g.lineWidth = lw; g.beginPath();
    for (let i = -Math.ceil(ox / 90); i <= Math.ceil((w - ox) / 90); i++) {
      const x = ox + i * 90;
      g.moveTo(x, GROUND + 6); g.lineTo(x + 14, GROUND + 18); g.lineTo(x + 6, GROUND + 30); g.lineTo(x + 24, GROUND + 44);
    }
    g.stroke();
  }
}

/** Chompa home. Static art is cached; per frame: smoke, lava streams, embers, pulsing floor glow/cracks, seams (<= 40 primitives). */
export function drawVolcano(ctx: CanvasRenderingContext2D, v: StageView): void {
  drawStatic(ctx, 'vol.sky', -200, GROUND + 200, sky);
  const pulse = 0.55 + 0.45 * Math.sin(v.t * Math.PI * 2 * 0.5 / 60);
  const fx = layerX(v, 0.2);
  // Smoke puffs: cached soft sprite (six large alpha arcs per frame were the volcano p95 outlier, see decision 0017).
  for (let i = 0; i < 6; i++) {
    const rise = (v.t * 0.25 + i * 30) % 180, r = 22 + rise * 0.25, cx = fx + Math.sin(i * 2 + rise / 40) * 18 + rise * 0.4;
    glowAt(ctx, cx, 80 - rise, r * 1.3, 'rgba(40,20,22,0.6)', 'rgba(40,20,22,0)');
  }
  // Mountain + lava streams: one tight 540x370 bitmap (was an 880x370 parallax layer, mostly transparent) placed at fx.
  if (fx > -270 && fx < 910) {
    const far = getLayer('vol.far') ?? cacheLayer('vol.far', 540, 370, g => { g.translate(0, 50); mountain(g, 270); streams(g, 270); });
    if (far) { const sc = getLayerScale(); ctx.drawImage(far as unknown as CanvasImageSource, Math.round((fx - 270) * sc) / sc, -50, 540, 370); }
  }
  glowAt(ctx, fx, 90, 60, 'rgba(255,190,70,0.95)', 'rgba(255,90,30,0)');
  drawParallax(ctx, 'vol.ridge', 0.35, 235, 85, layerX(v, 0.35), ridge);
  // Embers drifting up (render tick; decoration only). Batched into 4 fills (2 colours x 2 alpha bands) instead of 28 state changes.
  for (let band = 0; band < 4; band++) {
    ctx.globalAlpha = band & 2 ? 0.55 : 0.9; ctx.fillStyle = band & 1 ? '#ffb347' : '#ff6a2a'; ctx.beginPath();
    for (let i = 0; i < 28; i++) {
      if ((i & 1) !== (band & 1)) continue;
      const x = ((i * 97 + v.t * 0.3 * (1 + (i & 3))) % 700) - 30 + Math.sin(v.t / 40 + i) * 6;
      const y = GROUND - ((i * 53 + v.t * (0.6 + (i & 3) * 0.2)) % 340);
      if ((y > 170) !== ((band & 2) === 0)) continue; // lower embers (brighter near the ground) vs upper, fading
      const sz = 2 + (i & 1); ctx.rect(x, y, sz, sz);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawParallax(ctx, 'vol.fern', 0.5, 180, 140, layerX(v, 0.5) + 3 * Math.sin(v.t / 80), ferns);
  const nx = layerX(v, 1.0);
  drawParallax(ctx, 'vol.floor', 1.0, GROUND, 40, nx, floor);
  ctx.fillStyle = `rgba(255,110,40,${0.12 + 0.1 * pulse})`; ctx.fillRect(0, GROUND, 640, 5);
  floorSeams(ctx, nx, 'rgba(0,0,0,0.35)', 80, 1.7);
  // Lava cracks: baked once (wide dim + thin bright stroke), pulsed with globalAlpha only.
  ctx.globalAlpha = 0.5 + 0.5 * pulse;
  drawParallax(ctx, 'vol.cracks', 1.0, GROUND + 6, 40, nx, cracks);
  ctx.globalAlpha = 1;
}
