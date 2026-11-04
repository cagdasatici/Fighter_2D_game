import { GROUND } from '../Canvas.js';
import { glowAt, layerX, vgrad, type StageView } from '../Stage.js';
import { floorSeams } from './rooftop.js';

/** Chompa home: dusk sky, smoking volcano with lava streams, embers, fern silhouettes, cracked rock with pulsing lava. */
export function drawVolcano(ctx: CanvasRenderingContext2D, v: StageView): void {
  ctx.fillStyle = vgrad(ctx, '#1e0710', '#b5381a', -200, GROUND, '#5a1418'); ctx.fillRect(0, -200, 640, GROUND + 200);
  const pulse = 0.55 + 0.45 * Math.sin(v.t * Math.PI * 2 * 0.5 / 60);
  // Far (0.2): volcano with smoke plume, glowing crater and lava streams.
  const fx = layerX(v, 0.2);
  ctx.fillStyle = 'rgba(40,20,22,0.55)';
  for (let i = 0; i < 6; i++) {
    const rise = (v.t * 0.25 + i * 30) % 180;
    ctx.beginPath(); ctx.arc(fx + Math.sin(i * 2 + rise / 40) * 18 + rise * 0.4, 80 - rise, 22 + rise * 0.25, 0, Math.PI * 2); ctx.fill();
  }
  glowAt(ctx, fx, 90, 140, 'rgba(255,150,60,0.55)', 'rgba(255,80,30,0)');
  ctx.fillStyle = '#2a0f0c'; ctx.beginPath(); ctx.moveTo(fx - 260, GROUND); ctx.lineTo(fx - 40, 90); ctx.lineTo(fx + 40, 90); ctx.lineTo(fx + 260, GROUND); ctx.fill();
  ctx.fillStyle = '#3d1712'; ctx.beginPath(); ctx.moveTo(fx + 40, 90); ctx.lineTo(fx + 260, GROUND); ctx.lineTo(fx + 120, GROUND); ctx.fill(); // lit flank
  ctx.strokeStyle = `rgba(255,${120 + Math.round(60 * pulse)},40,0.9)`; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(fx - 10, 92); ctx.quadraticCurveTo(fx - 30, 150, fx - 70, 210);
  ctx.moveTo(fx + 15, 92); ctx.quadraticCurveTo(fx + 30, 160, fx + 20, 230);
  ctx.stroke();
  glowAt(ctx, fx, 90, 60, 'rgba(255,190,70,0.95)', 'rgba(255,90,30,0)');
  // Mid-far ridge (0.35).
  const rx = layerX(v, 0.35);
  ctx.fillStyle = '#1f0b0a'; ctx.beginPath(); ctx.moveTo(0, GROUND);
  for (let x = 0; x <= 640; x += 20) ctx.lineTo(x, GROUND - 50 - 18 * Math.sin((x - rx) / 60) - 10 * Math.sin((x - rx) / 23));
  ctx.lineTo(640, GROUND); ctx.fill();
  // Embers drifting up (render tick; decoration only).
  for (let i = 0; i < 28; i++) {
    const x = ((i * 97 + v.t * 0.3 * (1 + (i & 3))) % 700) - 30 + Math.sin(v.t / 40 + i) * 6;
    const y = GROUND - ((i * 53 + v.t * (0.6 + (i & 3) * 0.2)) % 340);
    ctx.globalAlpha = 0.4 + 0.6 * ((y + 20) / 360);
    ctx.fillStyle = i & 1 ? '#ffb347' : '#ff6a2a'; ctx.fillRect(x, y, 2 + (i & 1), 2 + (i & 1));
  }
  ctx.globalAlpha = 1;
  // Mid (0.5): giant ferns as layered bezier fans with leaflets.
  const mx = layerX(v, 0.5);
  ctx.lineCap = 'round';
  for (const base of [-480, -200, 140, 420]) {
    const bx = mx + base;
    if (bx < -120 || bx > 760) continue;
    for (let k = -3; k <= 3; k++) {
      const sw = Math.sin(v.t / 80 + base) * 3;
      const ex = bx + k * 50 + sw, ey = GROUND - 90 + Math.abs(k) * 12;
      ctx.strokeStyle = '#1d2a12'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(bx, GROUND);
      ctx.bezierCurveTo(bx + k * 10, GROUND - 80, bx + k * 30 + sw, GROUND - 120, ex, ey); ctx.stroke();
      // Leaflets: slim filled leaves along the outer half of each frond, angled towards its tip.
      ctx.fillStyle = '#1d2a12';
      const ang = Math.atan2(ey - (GROUND - 110), ex - bx);
      for (let j = 2; j <= 5; j++) {
        const tt = j / 6, px = bx + (ex - bx) * tt, py = GROUND - 100 * Math.sin(tt * 2.6) * (1 - tt * 0.15) + (ey - GROUND + 90) * tt;
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(px, py, 11 - j, 2.4, ang + sd * 0.9, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  }
  // Floor (1.0): dark rock, converging fissures, lava cracks pulsing at 0.5 Hz with a glow underlay.
  const nx = layerX(v, 1.0);
  ctx.fillStyle = vgrad(ctx, '#3a221a', '#160d0b', GROUND, 360); ctx.fillRect(0, GROUND, 640, 40);
  ctx.fillStyle = `rgba(255,110,40,${0.12 + 0.1 * pulse})`; ctx.fillRect(0, GROUND, 640, 5);
  floorSeams(ctx, nx, 'rgba(0,0,0,0.35)', 80, 1.7);
  ctx.lineJoin = 'round';
  for (const [w, a] of [[6, 0.25], [2, 1]] as const) {
    ctx.strokeStyle = `rgba(255,${110 + Math.round(60 * pulse)},40,${(0.5 + 0.5 * pulse) * a})`; ctx.lineWidth = w;
    ctx.beginPath();
    for (let i = -12; i <= 12; i++) {
      const x = nx + i * 90; if (x < -40 || x > 680) continue;
      ctx.moveTo(x, GROUND + 6); ctx.lineTo(x + 14, GROUND + 18); ctx.lineTo(x + 6, GROUND + 30); ctx.lineTo(x + 24, GROUND + 44);
    }
    ctx.stroke();
  }
}
