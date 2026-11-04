import type { Pose } from './poses.js';
import type { AnyBone, BoneId, Bones, DrawInfo, Seg, Skin } from './skins/types.js';

const RAD = Math.PI / 180;
/** Unit direction for an absolute angle (spec §9.2): (sin A · facing, −cos A), screen y down. */
export function dir(a: number, facing: 1 | -1 = 1): [number, number] { return [Math.sin(a * RAD) * facing, -Math.cos(a * RAD)]; }

const seg = (x0: number, y0: number, a: number, len: number, facing: 1 | -1): Seg => {
  const [dx, dy] = dir(a, facing);
  return { x0, y0, x1: x0 + dx * len, y1: y0 + dy * len, a };
};

/**
 * Pure bone solver: local pose angles → segment endpoints. Origin = the fighter's feet point, y down.
 * `frame` only drives render-only extras (scarf wave).
 */
export function solveBones(skin: Skin, pose: Pose, facing: 1 | -1, frame = 0, extra: Partial<Record<AnyBone, number>> = {}): Bones {
  const a = (k: AnyBone, d = 0): number => extra[k] ?? pose.a[k] ?? d;
  const L = (k: BoneId): number => skin.bones[k].len;
  const rootY = Math.min(-skin.hipHeight + pose.root.dy, -skin.bones.torso.width / 2);
  const rx = pose.root.dx * facing;
  const root: Seg = { x0: rx, y0: rootY, x1: rx, y1: rootY, a: 0 };
  const tA = a('torso') + skin.torsoLean;
  const torso = seg(rx, rootY, tA, L('torso'), facing);
  const head = seg(torso.x1, torso.y1, tA + a('head'), L('head'), facing);
  const [tdx, tdy] = dir(tA, facing);
  const sx = torso.x1 - tdx * 4, sy = torso.y1 - tdy * 4; // shoulder = torso end − 4 px along torso
  const arm = (u: number, f: number, fist: number): [Seg, Seg, Seg] => {
    const s1 = seg(sx, sy, tA + u, L('uArmF'), facing);
    const s2 = seg(s1.x1, s1.y1, s1.a + f, L('fArmF'), facing);
    return [s1, s2, seg(s2.x1, s2.y1, s2.a + fist, L('fistF'), facing)];
  };
  const leg = (t: number, s: number, ft: number): [Seg, Seg, Seg] => {
    const s1 = seg(rx, rootY, t, L('thighF'), facing);
    const s2 = seg(s1.x1, s1.y1, s1.a + s, L('shinF'), facing);
    return [s1, s2, seg(s2.x1, s2.y1, s2.a + ft, L('footF'), facing)];
  };
  const [uArmF, fArmF, fistF] = arm(a('uArmF', 140), a('fArmF', -110), a('fistF'));
  const [uArmB, fArmB, fistB] = arm(a('uArmB', 160), a('fArmB', -120), a('fistB'));
  const [thighF, shinF, footF] = leg(a('thighF', 160), a('shinF', 20), a('footF', -90));
  const [thighB, shinB, footB] = leg(a('thighB', 200), a('shinB', -10), a('footB', -90));
  const b: Bones = { root, torso, head, uArmF, fArmF, fistF, uArmB, fArmB, fistB, thighF, shinF, footF, thighB, shinB, footB };
  if (skin.tail) b.tail = seg(rx, rootY, tA + 210 + a('tail'), skin.tail.len, facing);
  b.jaw = seg(head.x1, head.y1, head.a + 90 + a('jaw'), L('head'), facing);
  if (skin.scarf) {
    let px = torso.x1, py = torso.y1;
    (['scarf1', 'scarf2', 'scarf3', 'scarf4'] as const).forEach((k, i) => {
      const s = seg(px, py, -100 - i * 4 + Math.sin((frame + i * 5) * 0.22) * 6 * (i + 1), skin.scarf!.segLen, facing);
      b[k] = s; px = s.x1; py = s.y1;
    });
  }
  return b;
}

// ---------- drawing helpers (all colours pass through the active tint) ----------
let tint: { color: string; k: number } | null = null;
let outlineColor = '#1b1b2a';
function hexRgb(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(c: string, to: string, k: number): string {
  if (!c.startsWith('#') || c.length !== 7) return c;
  const a = hexRgb(c), b = hexRgb(to);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * k)).join(',')})`;
}
/** Darken a hex colour by `pct` percent (B-limb shade = 25). */
export function shade(c: string, pct = 25): string { return mix(c, '#000000', pct / 100); }
const col = (c: string): string => (tint ? mix(c, tint.color, tint.k) : c);

export function capsule(ctx: CanvasRenderingContext2D, s: { x0: number; y0: number; x1: number; y1: number }, w: number, color: string): void {
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1);
  ctx.strokeStyle = outlineColor; ctx.lineWidth = w + 4; ctx.stroke();
  ctx.strokeStyle = col(color); ctx.lineWidth = w; ctx.stroke();
}
export function oval(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, rotDeg: number, color: string, outline = true): void {
  ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), rotDeg * RAD, 0, Math.PI * 2);
  ctx.fillStyle = col(color); ctx.fill();
  if (outline) { ctx.strokeStyle = outlineColor; ctx.lineWidth = 2; ctx.stroke(); }
}
export function poly(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], color: string, outline = true): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath(); ctx.fillStyle = col(color); ctx.fill();
  if (outline) { ctx.strokeStyle = outlineColor; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke(); }
}
export function stroke(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], w: number, color: string): void {
  ctx.beginPath(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = col(color); ctx.lineWidth = w; ctx.stroke();
}
/** Point at distance `along` the segment plus `side` px perpendicular (positive = towards the front/right of the bone). */
export function at(s: Seg, along: number, side = 0): [number, number] {
  const [dx, dy] = dir(s.a);
  return [s.x0 + dx * along - dy * side, s.y0 + dy * along + dx * side];
}
/** Canvas rotation (deg) for a shape whose long axis follows bone angle `a`. */
export const rotOf = (a: number): number => a - 90;

function defaultFist(ctx: CanvasRenderingContext2D, s: Seg, color: string, r: number): void { oval(ctx, s.x0, s.y0, r, r, 0, color); }
function defaultFoot(ctx: CanvasRenderingContext2D, s: Seg, color: string, w: number): void {
  oval(ctx, (s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2 + 1, Math.max(w * 0.5, Math.hypot(s.x1 - s.x0, s.y1 - s.y0) / 2 + 3), w * 0.42, rotOf(s.a), color);
}

export interface PuppetOpts {
  frame?: number; meterFull?: boolean; flash?: 'hit' | 'counter' | null; glow?: boolean;
  /** Extra local-angle tweaks (skin move overrides, jaw). */
  extra?: Partial<Record<AnyBone, number>>;
  /** Whole-puppet rotation in degrees around the hip (render-only `spin`). */
  spin?: number;
  scale?: number;
}

/** Draw a puppet with its feet at screen (x, y). Draw order per spec §9.2. */
export function drawPuppet(ctx: CanvasRenderingContext2D, skin: Skin, pose: Pose, x: number, y: number, facing: 1 | -1, opts: PuppetOpts = {}): void {
  const frame = opts.frame ?? 0;
  const b = solveBones(skin, pose, 1, frame, opts.extra ?? {});
  const pulseOn = opts.glow === true && frame % 60 < 30;
  outlineColor = pulseOn ? skin.accent : skin.outline;
  tint = opts.flash === 'hit' ? { color: '#ffffff', k: 0.85 } : opts.flash === 'counter' ? { color: '#ff2a2a', k: 0.6 } : null;
  const info: DrawInfo = { frame, meterFull: opts.meterFull ?? false, outline: outlineColor, jawOpen: opts.extra?.jaw ?? pose.a.jaw ?? 0 };
  ctx.save();
  ctx.translate(x, y); ctx.scale(facing * (opts.scale ?? 1), opts.scale ?? 1);
  if (opts.spin) { ctx.translate(b.root.x0, b.root.y0); ctx.rotate(opts.spin * RAD); ctx.translate(-b.root.x0, -b.root.y0); }
  const S = skin.bones;
  const limb = (k: BoneId, back: boolean): void => capsule(ctx, b[k], S[k].width, back ? shade(S[k].color) : S[k].color);
  const fist = (k: 'fistF' | 'fistB', back: boolean): void =>
    skin.drawFist ? skin.drawFist(ctx, b[k], back, info) : defaultFist(ctx, b[k], back ? shade(S[k].color) : S[k].color, S[k].width / 2);
  const foot = (k: 'footF' | 'footB', back: boolean): void =>
    skin.drawFoot ? skin.drawFoot(ctx, b[k], back, info) : defaultFoot(ctx, b[k], back ? shade(S[k].color) : S[k].color, S[k].width);
  if (skin.scarf) {
    const sc = skin.scarf;
    (['scarf4', 'scarf3', 'scarf2', 'scarf1'] as const).forEach((k, i) => { const s = b[k]; if (s) capsule(ctx, s, sc.width - i, shade(sc.color, 10)); });
  }
  if (skin.tail && b.tail) {
    const t = skin.tail, s = b.tail;
    const n = 5;
    for (let i = n - 1; i >= 0; i--) {
      const k0 = i / n, k1 = (i + 1) / n;
      capsule(ctx, { x0: s.x0 + (s.x1 - s.x0) * k0, y0: s.y0 + (s.y1 - s.y0) * k0, x1: s.x0 + (s.x1 - s.x0) * k1, y1: s.y0 + (s.y1 - s.y0) * k1 }, t.w0 + (t.w1 - t.w0) * k1, t.color);
    }
  }
  skin.drawBack?.(ctx, b, info);
  limb('uArmB', true); limb('fArmB', true); fist('fistB', true);
  limb('thighB', true); limb('shinB', true); foot('footB', true);
  skin.drawTorso(ctx, b, info);
  limb('thighF', false); limb('shinF', false); foot('footF', false);
  skin.drawHead(ctx, b, info);
  limb('uArmF', false); limb('fArmF', false); fist('fistF', false);
  skin.drawFront?.(ctx, b, info);
  ctx.restore();
  tint = null; outlineColor = '#1b1b2a';
}

/** Default torso: a fat capsule in the torso colour. */
export function torsoCapsule(ctx: CanvasRenderingContext2D, skin: Skin, b: Bones, color = skin.bones.torso.color): void {
  capsule(ctx, b.torso, skin.bones.torso.width, color);
}

export interface RigSpec {
  torso: number; head: number; uArm: number; fArm: number; thigh: number; shin: number; foot: number; fist: number;
  wTorso: number; wArm: number; wLeg: number; wFist: number; wFoot: number;
  c: { torso: string; head: string; uArm: string; fArm: string; fist: string; thigh: string; shin: string; foot: string };
}
/** Build the required bone styles from proportions (B limbs reuse the F style; shading is applied at draw time). */
export function rig(r: RigSpec): Skin['bones'] {
  const s = (len: number, width: number, color: string): { len: number; width: number; color: string } => ({ len, width, color });
  const uArm = s(r.uArm, r.wArm, r.c.uArm), fArm = s(r.fArm, r.wArm, r.c.fArm), fist = s(r.fist, r.wFist, r.c.fist);
  const thigh = s(r.thigh, r.wLeg, r.c.thigh), shin = s(r.shin, r.wLeg, r.c.shin), foot = s(r.foot, r.wFoot, r.c.foot);
  return {
    root: s(0, r.wTorso, r.c.torso), torso: s(r.torso, r.wTorso, r.c.torso), head: s(r.head, r.head * 2, r.c.head),
    uArmF: uArm, fArmF: fArm, fistF: fist, uArmB: uArm, fArmB: fArm, fistB: fist,
    thighF: thigh, shinF: shin, footF: foot, thighB: thigh, shinB: shin, footB: foot,
  };
}

/** Run `fn` in a canonical frame centred at (x, y): up = −y follows bone angle `a`, forward = +x. */
export function inFrame(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, fn: () => void): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a * RAD); fn(); ctx.restore();
}
