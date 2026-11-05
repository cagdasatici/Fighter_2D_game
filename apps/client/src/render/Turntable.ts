/**
 * SEL: fake-3D turntable and carousel ring for the character select. Render-only, no sim state.
 * Pure ring math (`ringSlots`, `ringTween`, `turntableYaw`) is exported for the unit tests.
 */
import { drawPuppet, drawShadow } from './Puppet.js';
import { getPose, lerpPose } from './poses.js';
import type { Skin } from './skins/types.js';

export interface RingSlot { i: number; theta: number; x: number; z: number; scale: number; alpha: number }

/** Ring slots for `n` items with continuous `focus` (in item steps), sorted back-to-front (focused one last). */
export function ringSlots(n: number, focus: number, radius = 1): RingSlot[] {
  const out: RingSlot[] = [];
  for (let i = 0; i < n; i++) {
    const theta = (2 * Math.PI * (i - focus)) / n;
    const z = Math.cos(theta);
    out.push({ i, theta, x: radius * Math.sin(theta), z, scale: 0.6 + 0.4 * (z + 1) / 2, alpha: 0.35 + 0.65 * (z + 1) / 2 });
  }
  return out.sort((a, b) => a.z - b.z);
}

export const RING_TWEEN_FRAMES = 18;
/** Eased (smoothstep) value between `from` and `to` after `f` of RING_TWEEN_FRAMES frames. */
export function ringTween(from: number, to: number, f: number): number {
  const k = Math.min(1, Math.max(0, f / RING_TWEEN_FRAMES));
  return from + (to - from) * k * k * (3 - 2 * k);
}

/** Shortest signed step count from index `a` to `b` on an `n` ring. */
export function ringDelta(a: number, b: number, n: number): number {
  let d = (((b - a) % n) + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

export const PICK_EASE_FRAMES = 20;
/** Yaw at frame `t`: one turn ≈ every 5 s; after a pick (at frame `pickedAt`) it eases to face the camera. */
export function turntableYaw(t: number, pickedAt: number | null): number {
  const spin = t * 0.02;
  if (pickedAt === null) return spin;
  const base = pickedAt * 0.02;
  // Ease from the nearest full turn so it settles on yaw ≡ 0 without unwinding.
  const wrapped = base - Math.round(base / (2 * Math.PI)) * 2 * Math.PI;
  const k = Math.min(1, (t - pickedAt) / PICK_EASE_FRAMES);
  return wrapped * (1 - k * k * (3 - 2 * k));
}

// ---------- cached sprites ----------
type Sprite = HTMLCanvasElement;
const sprites = new Map<string, Sprite>();
function sprite(key: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void): Sprite | null {
  const hit = sprites.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  paint(ctx);
  if (sprites.size > 32) sprites.clear(); // bounded: 5 accents × a few sprite kinds
  sprites.set(key, c);
  return c;
}

/** Podium: an elliptical stone disc with an accent rim glow (painted once per accent, drawn at 2× then scaled). */
function podium(accent: string): Sprite | null {
  return sprite(`podium:${accent}`, 320, 120, c => {
    const glow = c.createRadialGradient(160, 54, 40, 160, 54, 150);
    glow.addColorStop(0, accent); glow.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.55; c.fillStyle = glow;
    c.beginPath(); c.ellipse(160, 54, 156, 50, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    // Side band (thickness), then the top face.
    c.fillStyle = '#23203a'; c.beginPath(); c.ellipse(160, 66, 128, 34, 0, 0, Math.PI * 2); c.fill();
    c.fillRect(32, 50, 256, 16);
    const top = c.createLinearGradient(0, 18, 0, 86);
    top.addColorStop(0, '#5b5682'); top.addColorStop(1, '#34304f');
    c.fillStyle = top; c.beginPath(); c.ellipse(160, 50, 128, 34, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = accent; c.lineWidth = 5; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(160, 50, 96, 24, 0, 0, Math.PI * 2); c.stroke();
  });
}

/** Spotlight cone from the top of the screen in the accent colour. */
export function spotlight(accent: string): Sprite | null {
  return sprite(`spot:${accent}`, 400, 400, c => {
    const g = c.createLinearGradient(0, 0, 0, 400);
    g.addColorStop(0, accent); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.35; c.fillStyle = g;
    c.beginPath(); c.moveTo(170, 0); c.lineTo(230, 0); c.lineTo(390, 400); c.lineTo(10, 400); c.closePath(); c.fill();
  });
}

/** Soft round particle in the accent colour. */
export function particle(accent: string): Sprite | null {
  return sprite(`dot:${accent}`, 16, 16, c => {
    const g = c.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, accent); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 16, 16);
  });
}

export interface TurntableOpts {
  /** Frame at which the character was picked (win pose, eases to face camera), or null. */
  pickedAt?: number | null;
  scale?: number;
  /** Draw only a podium-less mini figure (ring background members). */
  noPodium?: boolean;
  /** Fixed yaw override (ring members not in focus). */
  yaw?: number;
}

/** Draw a fighter standing on a turntable podium with feet at (x, y). `t` = frame counter. */
export function drawTurntable(ctx: CanvasRenderingContext2D, skin: Skin, x: number, y: number, t: number, opts: TurntableOpts = {}): void {
  const sc = opts.scale ?? 1;
  const picked = opts.pickedAt ?? null;
  if (!opts.noPodium) {
    const p = podium(skin.accent);
    if (p) ctx.drawImage(p, x - 80 * sc, y - 25 * sc, 160 * sc, 60 * sc);
  }
  drawShadow(ctx, x, y, 0, 30 * sc);
  const yaw = opts.yaw ?? turntableYaw(t, picked);
  const idle = getPose('idle'), idle2 = getPose('idle2');
  const breathe = (Math.sin(t * 0.08) + 1) / 2;
  let pose = lerpPose(idle, idle2, breathe);
  if (picked !== null) pose = lerpPose(pose, getPose('victory'), Math.min(1, (t - picked) / PICK_EASE_FRAMES));
  drawPuppet(ctx, skin, pose, x, y, 1, { frame: t, yaw, scale: sc, squash: picked === null ? (breathe - 0.5) * 0.02 : 0 });
}
