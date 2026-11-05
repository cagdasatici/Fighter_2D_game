import { PX, type Projectile } from '@kb/shared';

/**
 * Per-character projectile visuals (docs/characters.md VFX lines). Render-only: reads projectile state, never writes it.
 * Glows are pre-rendered once per colour into small sprites (no per-frame gradient allocation).
 */

const glowCache = new Map<string, HTMLCanvasElement>();
/** 64×64 radial glow sprite for `color` (hex), cached forever (a handful of fixed colours). */
function glow(color: string): HTMLCanvasElement | null {
  const hit = glowCache.get(color);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, color); grad.addColorStop(0.35, `${color}aa`); grad.addColorStop(1, `${color}00`);
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  glowCache.set(color, c);
  return c;
}
export function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1): void {
  const s = glow(color);
  if (!s) return;
  ctx.globalAlpha = alpha; ctx.drawImage(s, x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1;
}

/** Deterministic 0..1 hash (render decoration only: jitter for lightning, egg spots). */
export function hash01(n: number): number {
  let h = (n | 0) * 374761393 + 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Jagged polyline x offsets for the lightning column (8 segments), seeded from the frame. */
export function boltJitter(seed: number, out: number[] = new Array<number>(9).fill(0), amp = 9): number[] {
  for (let i = 0; i < out.length; i++) out[i] = i === 0 || i === out.length - 1 ? 0 : (hash01(seed * 31 + i) * 2 - 1) * amp;
  return out;
}
const JIT = new Array<number>(9).fill(0);

const OUT = '#1b1b2a';

function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, d: number): void {
  drawGlow(ctx, x - d * 4, y, 18, '#ff8c1a', 0.7);
  ctx.strokeStyle = 'rgba(255,200,120,0.7)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (const o of [-3, 3]) { ctx.beginPath(); ctx.moveTo(x - d * 14, y + o); ctx.lineTo(x - d * 34, y + o); ctx.stroke(); }
  ctx.fillStyle = '#c9ced6'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(d > 0 ? x - 10 : x - 2, y - 3.5, 12, 7, 2); ctx.fill(); ctx.stroke();      // shank
  ctx.beginPath(); ctx.ellipse(x + d * 5, y, 4, 6.5, 0, 0, Math.PI * 2); ctx.fillStyle = '#e8ebf0'; ctx.fill(); ctx.stroke(); // head
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + d * 4 - 1, y - 4, 2, 3);
}

function spark(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  const wy = y + Math.sin(t * 0.35) * 3;
  drawGlow(ctx, x, wy, 30, '#c8ff3c', 0.9);
  ctx.strokeStyle = '#f6ffb0'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + t * 0.4, r0 = 9, r1 = 16 + hash01(t + i) * 6;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, wy + Math.sin(a) * r0);
    ctx.lineTo(x + Math.cos(a + 0.25) * (r0 + r1) / 2, wy + Math.sin(a + 0.25) * (r0 + r1) / 2);
    ctx.lineTo(x + Math.cos(a) * r1, wy + Math.sin(a) * r1); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(x, wy, 9, 0, Math.PI * 2); ctx.fillStyle = '#d7ff4a'; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.arc(x - 2, wy - 2, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
}

function egg(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, seed: number): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.18);
  ctx.beginPath(); ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fbf7ee'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#8c4fb0';
  for (let i = 0; i < 4; i++) {
    const a = hash01(seed + i * 7) * Math.PI * 2, r = 3 + hash01(seed + i * 13) * 5;
    ctx.beginPath(); ctx.ellipse(Math.cos(a) * r, Math.sin(a) * r * 1.1, 2.2, 1.7, a, 0, Math.PI * 2); ctx.fill();
  }
  ctx.beginPath(); ctx.ellipse(-3.5, -5, 2.5, 3.5, -0.4, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.restore();
}

function explosion(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number): void {
  // k: 1 at start → 0 at end.
  const r = (w / 2) * (1.1 - k * 0.5);
  drawGlow(ctx, x, y - h * 0.3, r * 1.6, '#ff7a1a', k);
  ctx.globalAlpha = Math.min(1, k * 1.5);
  ctx.fillStyle = '#ffb02e'; ctx.beginPath(); ctx.ellipse(x, y - h * 0.3, r, h * 0.55 * (1.1 - k * 0.5), 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.ellipse(x, y - h * 0.3, r * 0.55, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

function shuriken(ctx: CanvasRenderingContext2D, x: number, y: number, t: number): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 0.6); ctx.scale(1.4, 1.4);
  ctx.strokeStyle = 'rgba(230,57,70,0.45)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 12, 0.3, 2.2); ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? 3.2 : 10; i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.moveTo(r, 0); }
  ctx.closePath(); ctx.fillStyle = '#c8ccd6'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fillStyle = OUT; ctx.fill();
  ctx.restore();
}

function lightning(ctx: CanvasRenderingContext2D, x: number, groundY: number, h: number, t: number, k: number): void {
  const top = groundY - h;
  drawGlow(ctx, x, groundY, 46, '#ffe14d', 0.9 * k);
  ctx.globalAlpha = 0.35 * k; ctx.fillStyle = '#fff8c0'; ctx.fillRect(x - 20, top, 40, h); ctx.globalAlpha = 1;
  boltJitter(t, JIT);
  ctx.lineJoin = 'miter'; ctx.lineCap = 'round';
  const path = (): void => { ctx.beginPath(); for (let i = 0; i < JIT.length; i++) { const yy = top + (h * i) / 8; i ? ctx.lineTo(x + JIT[i]!, yy) : ctx.moveTo(x + JIT[i]!, yy); } };
  path(); ctx.strokeStyle = '#ffd400'; ctx.lineWidth = 10; ctx.stroke();
  path(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.stroke();
  ctx.globalAlpha = k; ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(x, groundY, 26, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
}

function dragon(ctx: CanvasRenderingContext2D, x: number, y: number, d: number, t: number): void {
  drawGlow(ctx, x, y, 56, '#3ddc97', 0.55);
  // Six trailing body circles follow the head along a delayed sine (3-frame delay each).
  for (let i = 6; i >= 1; i--) {
    const bx = x - d * i * 11, by = y + Math.sin((t - i * 3) * 0.25) * 9, r = 15 - i * 1.4;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 ? '#2fbf7f' : '#3ddc97'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
    if (i % 2 === 0) { ctx.fillStyle = 'rgba(255,240,170,0.9)'; ctx.fillRect(bx - 1, by - r - 3, 2, 3); }
  }
  const hy = y + Math.sin(t * 0.25) * 9;
  ctx.beginPath(); ctx.ellipse(x, hy, 19, 15, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#3ddc97'; ctx.fill(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + d * 12, hy + 4, 9, 6, 0, 0, Math.PI * 2); ctx.fillStyle = '#9ff2c8'; ctx.fill(); ctx.stroke(); // snout
  ctx.beginPath(); ctx.ellipse(x + d * 3, hy - 5, 3.6, 4, 0, 0, Math.PI * 2); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + d * 4, hy - 4.5, 1.8, 0, Math.PI * 2); ctx.fillStyle = OUT; ctx.fill();
  ctx.strokeStyle = '#e2b53c'; ctx.lineWidth = 2; ctx.lineCap = 'round';                                   // gold whiskers
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(x + d * 16, hy + 2 + s * 2);
    ctx.quadraticCurveTo(x + d * 28, hy + s * 12 + Math.sin(t * 0.3) * 3, x + d * 22, hy + s * 22); ctx.stroke();
  }
  ctx.fillStyle = '#fff3a0';
  for (let i = 0; i < 4; i++) { const sx = x - d * (20 + hash01(t + i) * 70), sy = hy + (hash01(t * 3 + i) - 0.5) * 40; ctx.fillRect(sx, sy, 2.5, 2.5); }
}

/** Draw one projectile. `sx/sy` map world px (y up) to screen; `t` is the sim frame (deterministic decoration). */
export function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile, sx: (x: number) => number, sy: (y: number) => number, t: number, accent: string): void {
  const x = sx(p.x / PX), y = sy(p.y / PX), d = p.vx >= 0 ? 1 : -1;
  ctx.save();
  if (p.exploding > 0) explosion(ctx, x, y, p.w, p.h, Math.min(1, p.exploding / 20));
  else switch (p.kind) {
    case 'rivet': rivet(ctx, x, y, d); break;
    case 'spark': spark(ctx, x, y, t); break;
    case 'egg': egg(ctx, x, y, t, p.owner * 101 + 17); break;
    case 'shuriken': shuriken(ctx, x, y, t); break;
    case 'lightningColumn': lightning(ctx, x, sy(0), p.h, t, Math.min(1, p.life / 8)); break;
    case 'jadeDragon': dragon(ctx, x, y, d, t); break;
    default:
      drawGlow(ctx, x, y, Math.max(p.w, p.h), accent, 0.8);
      ctx.fillStyle = accent; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x, y, p.w / 2, p.h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
