import { GROUND } from '../Canvas.js';
import { drawParallax } from '../Layers.js';
import { drawStatic, glowAt, layerX, vgrad, type StageView } from '../Stage.js';

/** Floor seams that converge towards the horizon for depth (shared by stage floors). One path, one stroke per frame. */
export function floorSeams(ctx: CanvasRenderingContext2D, nx: number, color: string, spacing: number, spread = 1.6): void {
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = -24; i <= 24; i++) {
    const xt = nx + i * spacing, xb = 320 + (xt - 320) * spread;
    if (Math.max(xt, xb) < -40 || Math.min(xt, xb) > 680) continue;
    ctx.moveTo(xt, GROUND); ctx.lineTo(xb, 360);
  }
  ctx.stroke();
}

function sky(g: CanvasRenderingContext2D): void {
  // Deep plum overhead to warm orange at the horizon (spec colours #5b3a7a / #ff9a5a).
  g.fillStyle = vgrad(g, '#3a2458', '#ff9a5a', -200, GROUND - 40, '#b4507a'); g.fillRect(0, -200, 640, GROUND + 200);
}
function sun(g: CanvasRenderingContext2D, ox: number): void {
  const sunX = ox + 90;
  glowAt(g, sunX, GROUND - 175, 150, 'rgba(255,220,150,0.75)', 'rgba(255,140,90,0)');
  g.beginPath(); g.arc(sunX, GROUND - 175, 34, 0, Math.PI * 2); g.fillStyle = '#ffe6a8'; g.fill();
}
function veryFar(g: CanvasRenderingContext2D, ox: number, w: number): void {
  g.fillStyle = '#7a4a7e';
  for (let i = -12; i <= 12; i++) {
    const bw = 40 + ((i * 11) & 15), h = 60 + ((i * 29) & 47), x = ox + i * 44 - bw / 2;
    if (x > w + 20 || x + bw < -20) continue;
    g.fillRect(x, GROUND - 20 - h - 40, bw, h + 60);
  }
}
const beaconTop = (i: number): number => GROUND - 40 - (70 + ((i * 37) & 63)) - 19;
function far(g: CanvasRenderingContext2D, ox: number, w: number): void {
  for (let i = -14; i <= 14; i++) {
    const bw = 34 + (i * 7 & 15), h = 70 + ((i * 37) & 63), x = ox + i * 48 - bw / 2;
    if (x > w + 20 || x + bw < -20) continue;
    const top = GROUND - 40 - h;
    g.fillStyle = '#2b2140'; g.fillRect(x, top, bw, h + 40);
    g.fillStyle = '#ff9d6a'; g.fillRect(x + bw - 2, top, 2, h + 40);              // sun-side rim light
    g.fillStyle = '#ffd98a';
    for (let r = 0; r < h / 12 - 1; r++) for (let c = 0; c < bw / 10 - 1; c++) {
      if (((i * 31 + r * 7 + c * 13) & 7) < 3) g.fillRect(x + 5 + c * 10, top + 8 + r * 12, 4, 5);
    }
    if ((i & 3) === 1) { g.fillStyle = '#2b2140'; g.fillRect(x + bw / 2 - 1, top - 18, 2, 18); }
  }
}
function mid(g: CanvasRenderingContext2D, ox: number): void {
  for (const tx of [-420, -120, 260, 520]) {
    const x = ox + tx;
    g.fillStyle = '#1e1630';
    g.fillRect(x - 22, GROUND - 90, 44, 46);
    g.beginPath(); g.moveTo(x - 26, GROUND - 90); g.lineTo(x, GROUND - 108); g.lineTo(x + 26, GROUND - 90); g.fill();
    g.fillRect(x - 18, GROUND - 44, 4, 44); g.fillRect(x + 14, GROUND - 44, 4, 44);
    g.strokeStyle = '#2e2448'; g.lineWidth = 1;
    g.beginPath(); for (const sy of [-80, -68, -56]) { g.moveTo(x - 22, GROUND + sy); g.lineTo(x + 22, GROUND + sy); } g.stroke();
    g.strokeStyle = '#ff9d6a'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x + 22, GROUND - 44); g.lineTo(x + 22, GROUND - 90); g.lineTo(x, GROUND - 108); g.stroke();
  }
  const cx = ox + 60;
  g.fillStyle = '#1e1630';
  g.fillRect(cx - 5, GROUND - 230, 10, 230);
  g.fillRect(cx - 80, GROUND - 232, 220, 7);
  g.strokeStyle = '#1e1630'; g.lineWidth = 1.5;
  g.beginPath();
  for (let y = GROUND - 225; y < GROUND; y += 16) { g.moveTo(cx - 5, y); g.lineTo(cx + 5, y + 16); }
  for (let x = cx - 80; x < cx + 140; x += 14) { g.moveTo(x, GROUND - 225); g.lineTo(x + 7, GROUND - 236); }
  g.moveTo(cx, GROUND - 260); g.lineTo(cx - 80, GROUND - 230); g.moveTo(cx, GROUND - 260); g.lineTo(cx + 140, GROUND - 230);
  g.moveTo(cx - 4, GROUND - 232); g.lineTo(cx, GROUND - 260); g.lineTo(cx + 4, GROUND - 232);
  g.stroke();
}
function front(g: CanvasRenderingContext2D, _ox: number, w: number): void {
  // Parapet wall at the far edge of the roof, then the tar floor (seams are drawn per frame).
  g.fillStyle = '#3b2f4c'; g.fillRect(0, GROUND - 14, w, 14);
  g.fillStyle = '#56456a'; g.fillRect(0, GROUND - 16, w, 3);
  g.fillStyle = 'rgba(255,157,106,0.5)'; g.fillRect(0, GROUND - 16, w, 1);
  g.fillStyle = vgrad(g, '#3d3446', '#1c1822', GROUND, 360); g.fillRect(0, GROUND, w, 40);
  g.fillStyle = 'rgba(255,154,90,0.12)'; g.fillRect(0, GROUND, w, 6);
  g.fillStyle = '#4a3f56'; g.fillRect(0, GROUND, w, 2);
}

/** Bolt/Volt home. Static parts are cached layers; per frame only clouds, beacons, crane hook and floor seams are drawn (<= 20 primitives). */
export function drawRooftop(ctx: CanvasRenderingContext2D, v: StageView): void {
  drawStatic(ctx, 'roof.sky', -200, GROUND + 200, sky);
  drawParallax(ctx, 'roof.sun', 0.1, -10, 310, layerX(v, 0.1), sun);
  // Drifting cloud streaks (animated).
  ctx.fillStyle = 'rgba(255,190,190,0.35)';
  for (let i = 0; i < 6; i++) {
    const x = ((i * 173 + v.t * 0.08 * (1 + (i & 1))) % 900) - 130 - v.camX * 0.05, y = 30 + i * 26;
    ctx.beginPath(); ctx.ellipse(x, y, 70 + (i % 3) * 25, 6 + (i & 1) * 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  drawParallax(ctx, 'roof.vfar', 0.12, 150, 170, layerX(v, 0.12), veryFar);
  drawParallax(ctx, 'roof.far', 0.2, 120, 200, layerX(v, 0.2), far);
  // Blinking antenna beacons on the far skyline (animated).
  const fx = layerX(v, 0.2), on = v.t >> 5;
  ctx.fillStyle = '#ff4a4a'; ctx.beginPath();
  for (let i = -11; i <= 13; i += 4) { // i & 3 === 1
    const x = fx + i * 48;
    if (x < -20 || x > 660 || !((on + i) & 1)) continue;
    ctx.moveTo(x + 2.2, beaconTop(i)); ctx.arc(x, beaconTop(i), 2.2, 0, Math.PI * 2);
  }
  ctx.fill();
  drawParallax(ctx, 'roof.mid', 0.5, 50, 270, layerX(v, 0.5), mid);
  // Crane hook sway and top beacon (animated).
  const cx = layerX(v, 0.5) + 60, sway = Math.sin(v.t / 70) * 6;
  ctx.strokeStyle = '#1e1630'; ctx.lineWidth = 1.5; ctx.fillStyle = '#1e1630';
  ctx.beginPath(); ctx.moveTo(cx + 120, GROUND - 225); ctx.lineTo(cx + 120 + sway, GROUND - 165); ctx.stroke();
  ctx.fillRect(cx + 114 + sway, GROUND - 166, 12, 6);
  if ((v.t >> 5) & 1) { ctx.fillStyle = '#ff4a4a'; ctx.beginPath(); ctx.arc(cx, GROUND - 262, 2.5, 0, Math.PI * 2); ctx.fill(); }
  drawParallax(ctx, 'roof.floor', 1.0, GROUND - 16, 56, layerX(v, 1.0), front);
  floorSeams(ctx, layerX(v, 1.0), 'rgba(0,0,0,0.35)', 64);
}
