import { GROUND } from '../Canvas.js';
import { layerX, vgrad, type StageView } from '../Stage.js';

/** Chompa home: dusk sky, glowing volcano, rising embers, giant ferns, cracked rock with pulsing lava. */
export function drawVolcano(ctx: CanvasRenderingContext2D, v: StageView): void {
  ctx.fillStyle = '#3a0d0d'; ctx.fillRect(0, -200, 640, 200);
  ctx.fillStyle = vgrad(ctx, '#3a0d0d', '#b5381a'); ctx.fillRect(0, 0, 640, GROUND);
  // Far (0.2): volcano with glowing crater.
  const fx = layerX(v, 0.2);
  ctx.fillStyle = '#2a0f0c'; ctx.beginPath(); ctx.moveTo(fx - 260, GROUND); ctx.lineTo(fx - 40, 90); ctx.lineTo(fx + 40, 90); ctx.lineTo(fx + 260, GROUND); ctx.fill();
  const glow = ctx.createRadialGradient(fx, 90, 4, fx, 90, 60);
  glow.addColorStop(0, 'rgba(255,190,70,0.9)'); glow.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.fillStyle = glow; ctx.fillRect(fx - 60, 30, 120, 120);
  // Embers drifting up (render tick; decoration only).
  ctx.fillStyle = '#ffb347';
  for (let i = 0; i < 24; i++) {
    const x = ((i * 97 + v.t * 0.3 * (1 + (i & 3))) % 700) - 30 + Math.sin(v.t / 40 + i) * 6;
    const y = GROUND - ((i * 53 + v.t * (0.6 + (i & 3) * 0.2)) % 340);
    ctx.globalAlpha = 0.4 + 0.6 * ((y + 20) / 360); ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
  // Mid (0.5): giant ferns as bezier fans.
  const mx = layerX(v, 0.5);
  ctx.strokeStyle = '#1d2a12'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  for (const base of [-480, -200, 140, 420]) {
    const bx = mx + base;
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath(); ctx.moveTo(bx, GROUND);
      ctx.bezierCurveTo(bx + k * 10, GROUND - 80, bx + k * 30, GROUND - 120, bx + k * 50, GROUND - 90 + Math.abs(k) * 12);
      ctx.stroke();
    }
  }
  // Near (1.0) + floor: dark rock with lava cracks pulsing at 0.5 Hz.
  const nx = layerX(v, 1.0);
  ctx.fillStyle = '#231814'; ctx.fillRect(0, GROUND, 640, 60);
  const pulse = 0.55 + 0.45 * Math.sin(v.t * Math.PI * 2 * 0.5 / 60);
  ctx.strokeStyle = `rgba(255,${110 + Math.round(60 * pulse)},40,${0.5 + 0.5 * pulse})`; ctx.lineWidth = 2;
  for (let i = -12; i <= 12; i++) {
    const x = nx + i * 90; if (x < -40 || x > 680) continue;
    ctx.beginPath(); ctx.moveTo(x, GROUND + 6); ctx.lineTo(x + 14, GROUND + 18); ctx.lineTo(x + 6, GROUND + 30); ctx.lineTo(x + 24, GROUND + 44); ctx.stroke();
  }
}
