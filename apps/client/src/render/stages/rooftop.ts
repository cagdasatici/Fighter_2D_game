import { GROUND } from '../Canvas.js';
import { glowAt, layerX, vgrad, type StageView } from '../Stage.js';

/** Floor seams that converge towards the horizon for depth (shared by stage floors). */
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

/** Bolt/Volt home: sunset sky with sun and clouds, two skyline depths, tanks + crane, tar roof with parapet. */
export function drawRooftop(ctx: CanvasRenderingContext2D, v: StageView): void {
  // Sky: deep plum overhead to warm orange at the horizon (spec colours #5b3a7a / #ff9a5a).
  ctx.fillStyle = vgrad(ctx, '#3a2458', '#ff9a5a', -200, GROUND - 40, '#b4507a'); ctx.fillRect(0, -200, 640, GROUND + 200);
  // Sun (parallax 0.1) with a soft glow.
  const sunX = layerX(v, 0.1) + 90;
  glowAt(ctx, sunX, GROUND - 175, 150, 'rgba(255,220,150,0.75)', 'rgba(255,140,90,0)');
  ctx.beginPath(); ctx.arc(sunX, GROUND - 175, 34, 0, Math.PI * 2); ctx.fillStyle = '#ffe6a8'; ctx.fill();
  // Drifting cloud streaks.
  ctx.fillStyle = 'rgba(255,190,190,0.35)';
  for (let i = 0; i < 6; i++) {
    const x = ((i * 173 + v.t * 0.08 * (1 + (i & 1))) % 900) - 130 - v.camX * 0.05, y = 30 + i * 26;
    ctx.beginPath(); ctx.ellipse(x, y, 70 + (i % 3) * 25, 6 + (i & 1) * 3, 0, 0, Math.PI * 2); ctx.fill();
  }
  // Very far skyline (0.12): hazy silhouettes.
  const vx = layerX(v, 0.12);
  ctx.fillStyle = '#7a4a7e';
  for (let i = -12; i <= 12; i++) {
    const w = 40 + ((i * 11) & 15), h = 60 + ((i * 29) & 47), x = vx + i * 44 - w / 2;
    if (x > 660 || x + w < -20) continue;
    ctx.fillRect(x, GROUND - 20 - h - 40, w, h + 60);
  }
  // Far skyline (0.2): lit windows, sunlit rim, blinking antenna beacons.
  const fx = layerX(v, 0.2);
  for (let i = -14; i <= 14; i++) {
    const w = 34 + (i * 7 & 15), h = 70 + ((i * 37) & 63), x = fx + i * 48 - w / 2;
    if (x > 660 || x + w < -20) continue;
    const top = GROUND - 40 - h;
    ctx.fillStyle = '#2b2140'; ctx.fillRect(x, top, w, h + 40);
    ctx.fillStyle = '#ff9d6a'; ctx.fillRect(x + w - 2, top, 2, h + 40);              // sun-side rim light
    ctx.fillStyle = '#ffd98a';
    for (let r = 0; r < h / 12 - 1; r++) for (let c = 0; c < w / 10 - 1; c++) {
      if (((i * 31 + r * 7 + c * 13) & 7) < 3) ctx.fillRect(x + 5 + c * 10, top + 8 + r * 12, 4, 5);
    }
    if ((i & 3) === 1) {
      ctx.fillStyle = '#2b2140'; ctx.fillRect(x + w / 2 - 1, top - 18, 2, 18);
      if (((v.t >> 5) + i) & 1) { ctx.fillStyle = '#ff4a4a'; ctx.beginPath(); ctx.arc(x + w / 2, top - 19, 2.2, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // Mid (0.5): water tanks with staves + rim light, lattice crane with swaying hook.
  const mx = layerX(v, 0.5);
  for (const tx of [-420, -120, 260, 520]) {
    const x = mx + tx;
    if (x < -60 || x > 700) continue;
    ctx.fillStyle = '#1e1630';
    ctx.fillRect(x - 22, GROUND - 90, 44, 46);
    ctx.beginPath(); ctx.moveTo(x - 26, GROUND - 90); ctx.lineTo(x, GROUND - 108); ctx.lineTo(x + 26, GROUND - 90); ctx.fill();
    ctx.fillRect(x - 18, GROUND - 44, 4, 44); ctx.fillRect(x + 14, GROUND - 44, 4, 44);
    ctx.strokeStyle = '#2e2448'; ctx.lineWidth = 1;
    ctx.beginPath(); for (const sy of [-80, -68, -56]) { ctx.moveTo(x - 22, GROUND + sy); ctx.lineTo(x + 22, GROUND + sy); } ctx.stroke();
    ctx.strokeStyle = '#ff9d6a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x + 22, GROUND - 44); ctx.lineTo(x + 22, GROUND - 90); ctx.lineTo(x, GROUND - 108); ctx.stroke();
  }
  const cx = mx + 60;
  ctx.fillStyle = '#1e1630';
  ctx.fillRect(cx - 5, GROUND - 230, 10, 230);
  ctx.fillRect(cx - 80, GROUND - 232, 220, 7);
  ctx.strokeStyle = '#1e1630'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let y = GROUND - 225; y < GROUND; y += 16) { ctx.moveTo(cx - 5, y); ctx.lineTo(cx + 5, y + 16); }
  for (let x = cx - 80; x < cx + 140; x += 14) { ctx.moveTo(x, GROUND - 225); ctx.lineTo(x + 7, GROUND - 236); }
  ctx.moveTo(cx, GROUND - 260); ctx.lineTo(cx - 80, GROUND - 230); ctx.moveTo(cx, GROUND - 260); ctx.lineTo(cx + 140, GROUND - 230);
  ctx.moveTo(cx - 4, GROUND - 232); ctx.lineTo(cx, GROUND - 260); ctx.lineTo(cx + 4, GROUND - 232);
  ctx.stroke();
  const sway = Math.sin(v.t / 70) * 6;
  ctx.beginPath(); ctx.moveTo(cx + 120, GROUND - 225); ctx.lineTo(cx + 120 + sway, GROUND - 165); ctx.stroke();
  ctx.fillRect(cx + 114 + sway, GROUND - 166, 12, 6);
  if ((v.t >> 5) & 1) { ctx.fillStyle = '#ff4a4a'; ctx.beginPath(); ctx.arc(cx, GROUND - 262, 2.5, 0, Math.PI * 2); ctx.fill(); }
  // Parapet wall at the far edge of the roof.
  ctx.fillStyle = '#3b2f4c'; ctx.fillRect(0, GROUND - 14, 640, 14);
  ctx.fillStyle = '#56456a'; ctx.fillRect(0, GROUND - 16, 640, 3);
  ctx.fillStyle = 'rgba(255,157,106,0.5)'; ctx.fillRect(0, GROUND - 16, 640, 1);
  // Floor (1.0): tar roof with converging seams and warm sky reflection. No markings under the HUD.
  const nx = layerX(v, 1.0);
  ctx.fillStyle = vgrad(ctx, '#3d3446', '#1c1822', GROUND, 360); ctx.fillRect(0, GROUND, 640, 40);
  ctx.fillStyle = 'rgba(255,154,90,0.12)'; ctx.fillRect(0, GROUND, 640, 6);
  floorSeams(ctx, nx, 'rgba(0,0,0,0.35)', 64);
  ctx.fillStyle = '#4a3f56'; ctx.fillRect(0, GROUND, 640, 2);
}
