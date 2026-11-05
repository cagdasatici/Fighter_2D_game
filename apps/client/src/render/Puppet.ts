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
const mixCache = new Map<string, Map<string, Map<number, string>>>();
/** Blend hex `c` towards `to` by `k`. Results are memoised so the hot draw path allocates no new strings. */
export function mix(c: string, to: string, k: number): string {
  if (!c.startsWith('#') || c.length !== 7) return c;
  // Nested lookup (colour -> target -> amount): no string is built on the hot path.
  let byTo = mixCache.get(c);
  if (!byTo) { byTo = new Map(); mixCache.set(c, byTo); }
  let byK = byTo.get(to);
  if (!byK) { byK = new Map(); byTo.set(to, byK); }
  const hit = byK.get(k);
  if (hit !== undefined) return hit;
  const a = hexRgb(c), b = hexRgb(to);
  const out = `#${a.map((v, i) => Math.round(v + (b[i]! - v) * k).toString(16).padStart(2, '0')).join('')}`;
  if (byK.size < 64) byK.set(k, out); // bounded: tints/shades come from a small fixed palette
  return out;
}
/** Darken a hex colour by `pct` percent (B-limb shade = 25). */
export function shade(c: string, pct = 25): string { return mix(c, '#000000', pct / 100); }
/** Lighten a hex colour by `pct` percent (rim light). */
export function light(c: string, pct = 35): string { return mix(c, '#ffffff', pct / 100); }
const col = (c: string): string => (tint ? mix(c, tint.color, tint.k) : c);

/** Outline weight shared by every puppet shape (consistent linework across the cast). */
export const LINE = 2;
/**
 * Capsule limb: dark outline, base fill, a shadow band on the lower side and a rim-light band on the upper side.
 * `base` is the unshaded hex colour; `back` darkens it for far-side limbs.
 */
export function capsule(ctx: CanvasRenderingContext2D, s: { x0: number; y0: number; x1: number; y1: number }, w: number, color: string, back = false): void {
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1);
  ctx.strokeStyle = outlineColor; ctx.lineWidth = w + LINE * 2; ctx.stroke();
  const hex = color.startsWith('#');
  const base = hex && back ? shade(color) : color;
  ctx.strokeStyle = col(base); ctx.lineWidth = w; ctx.stroke();
  if (!hex || w < 5) return;
  // Normal pointing "up" on screen: light comes from above.
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }
  const off = w * 0.24;
  ctx.lineWidth = w * 0.34;
  ctx.beginPath(); ctx.moveTo(s.x0 - nx * off, s.y0 - ny * off); ctx.lineTo(s.x1 - nx * off, s.y1 - ny * off);
  ctx.strokeStyle = col(shade(color, back ? 42 : 18)); ctx.stroke();
  ctx.lineWidth = w * 0.2;
  ctx.beginPath(); ctx.moveTo(s.x0 + nx * off * 1.2, s.y0 + ny * off * 1.2); ctx.lineTo(s.x1 + nx * off * 1.2, s.y1 + ny * off * 1.2);
  ctx.strokeStyle = col(back ? light(color, 5) : light(color, 38)); ctx.stroke();
}
/** Ellipse. Outlined ovals of a hex colour get a three-tone cel shade (shadow rim, base, highlight). */
export function oval(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, rotDeg: number, color: string, outline = true): void {
  rx = Math.max(0.1, rx); ry = Math.max(0.1, ry);
  const r = rotDeg * RAD;
  const shaded = outline && color.startsWith('#') && rx > 3.5 && ry > 3.5;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, r, 0, Math.PI * 2);
  ctx.fillStyle = col(shaded ? shade(color, 20) : color); ctx.fill();
  if (shaded) {
    ctx.beginPath(); ctx.ellipse(cx - rx * 0.06, cy - ry * 0.1, rx * 0.86, ry * 0.84, r, 0, Math.PI * 2);
    ctx.fillStyle = col(color); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - rx * 0.28, cy - ry * 0.4, rx * 0.34, ry * 0.22, r, 0, Math.PI * 2);
    ctx.fillStyle = col(light(color, 45)); ctx.fill();
  }
  if (outline) {
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, r, 0, Math.PI * 2);
    ctx.strokeStyle = outlineColor; ctx.lineWidth = LINE; ctx.stroke();
  }
}
export function poly(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], color: string, outline = true): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath(); ctx.fillStyle = col(color); ctx.fill();
  if (outline) { ctx.strokeStyle = outlineColor; ctx.lineWidth = LINE; ctx.lineJoin = 'round'; ctx.stroke(); }
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

function defaultFist(ctx: CanvasRenderingContext2D, s: Seg, color: string, r: number): void {
  oval(ctx, s.x0, s.y0, r, r, 0, color);
  // Knuckle crease on the leading side of the hand.
  const [dx, dy] = dir(s.a);
  ctx.beginPath(); ctx.moveTo(s.x0 + dx * r * 0.35 - dy * r * 0.55, s.y0 + dy * r * 0.35 + dx * r * 0.55);
  ctx.lineTo(s.x0 + dx * r * 0.35 + dy * r * 0.55, s.y0 + dy * r * 0.35 - dx * r * 0.55);
  ctx.strokeStyle = outlineColor; ctx.lineWidth = 1.2; ctx.stroke();
}
function defaultFoot(ctx: CanvasRenderingContext2D, s: Seg, color: string, w: number): void {
  const cx = (s.x0 + s.x1) / 2, cy = (s.y0 + s.y1) / 2 + 1, rx = Math.max(w * 0.5, Math.hypot(s.x1 - s.x0, s.y1 - s.y0) / 2 + 3), ry = w * 0.42;
  oval(ctx, cx, cy, rx, ry, rotOf(s.a), color);
  // Shoe sole: a darker strip along the bottom edge.
  ctx.beginPath(); ctx.ellipse(cx, cy + ry * 0.55, rx * 0.9, ry * 0.3, rotOf(s.a) * RAD, 0, Math.PI);
  ctx.fillStyle = col(shade(color, 45)); ctx.fill();
}

/**
 * Shared cartoon eye so every face reads in the same style: white, pupil, highlight, lid line.
 * `mood` hurt = squeezed shut, fierce = narrowed lid. Coordinates are in the head's local frame.
 */
export function eye(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, mood: Mood, iris = '#1b1b2a'): void {
  if (mood === 'hurt') {
    ctx.beginPath(); ctx.moveTo(x - r, y - r * 0.6); ctx.lineTo(x + r * 0.6, y); ctx.lineTo(x - r, y + r * 0.6);
    ctx.strokeStyle = outlineColor; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke();
    return;
  }
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2);
  ctx.fillStyle = col('#fffaf0'); ctx.fill(); ctx.strokeStyle = outlineColor; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + r * 0.3, y + r * 0.1, r * 0.48, r * 0.62, 0, 0, Math.PI * 2);
  ctx.fillStyle = col(iris); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + r * 0.45, y - r * 0.2, r * 0.18, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  if (mood === 'fierce') {
    ctx.beginPath(); ctx.moveTo(x - r * 1.1, y - r * 0.9); ctx.lineTo(x + r * 1.1, y - r * 0.2);
    ctx.lineTo(x + r * 1.1, y - r * 1.3); ctx.lineTo(x - r * 1.1, y - r * 1.3); ctx.closePath();
    ctx.fillStyle = curSkinCol; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - r * 1.1, y - r * 0.9); ctx.lineTo(x + r * 1.1, y - r * 0.2);
    ctx.strokeStyle = outlineColor; ctx.lineWidth = 1.4; ctx.stroke();
  }
}
/** Lid colour for the fierce eye (the head's skin tone); set per skin draw by `setLidColor`. */
let curSkinCol = '#e8a87c';
export function setLidColor(c: string): void { curSkinCol = col(c); }

/** Soft ground shadow under a fighter; shrinks and fades with height above the floor. */
export function drawShadow(ctx: CanvasRenderingContext2D, x: number, groundY: number, height: number, width = 30): void {
  const k = Math.max(0.35, 1 - height / 220);
  ctx.globalAlpha = 0.32 * k;
  ctx.beginPath(); ctx.ellipse(x, groundY + 2, width * k, 6 * k, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0614'; ctx.fill();
  ctx.globalAlpha = 1;
}

export type Mood = 'normal' | 'hurt' | 'fierce';
const HIT_TINT = { color: '#ffffff', k: 0.85 }, COUNTER_TINT = { color: '#ff2a2a', k: 0.6 };

export interface PuppetOpts {
  frame?: number; meterFull?: boolean; flash?: 'hit' | 'counter' | null; glow?: boolean;
  /** Extra local-angle tweaks (skin move overrides, jaw). */
  extra?: Partial<Record<AnyBone, number>>;
  /** Whole-puppet rotation in degrees around the hip (render-only `spin`). */
  spin?: number;
  scale?: number;
  /** Squash (+) / stretch (−) amount around the feet, e.g. 0.12 = 12 % wider and shorter. */
  squash?: number;
  mood?: Mood;
  /** Render-only turntable yaw in radians (SEL). Undefined/0 = the normal side view. */
  yaw?: number;
}

/** Draw-order parts (spec §9.2). `armB`/`legB` = far-side limbs, drawn shaded. */
export type Part = 'scarf' | 'tail' | 'drawBack' | 'armB' | 'legB' | 'torso' | 'legF' | 'head' | 'armF' | 'drawFront';
const ORDER: readonly Part[] = ['scarf', 'tail', 'drawBack', 'armB', 'legB', 'torso', 'legF', 'head', 'armF', 'drawFront'];
const ORDER_SWAPPED: readonly Part[] = ORDER.map(p => (p === 'armB' ? 'armF' : p === 'armF' ? 'armB' : p === 'legB' ? 'legF' : p === 'legF' ? 'legB' : p));
/** Limb draw order for a yaw: when sin(yaw) < 0 the far and near limbs trade places. */
export function drawOrder(yaw = 0): readonly Part[] { return Math.sin(yaw) < 0 ? ORDER_SWAPPED : ORDER; }
/** Horizontal squash and facing for a yaw: |sx| = max(|cos yaw|, 0.08); facing flips when cos < 0. */
export function yawScale(yaw: number, facing: 1 | -1): { sx: number; facing: 1 | -1 } {
  const c = Math.cos(yaw);
  const f: 1 | -1 = c < 0 ? (facing === 1 ? -1 : 1) : facing;
  return { sx: Math.max(Math.abs(c), 0.08), facing: f };
}

// Hoisted out of drawPuppet so no closures are allocated per draw (decision 0014).
function limb(ctx: CanvasRenderingContext2D, skin: Skin, b: Bones, k: BoneId, back: boolean): void { capsule(ctx, b[k], skin.bones[k].width, skin.bones[k].color, back); }
function fist(ctx: CanvasRenderingContext2D, skin: Skin, b: Bones, k: 'fistF' | 'fistB', back: boolean): void {
  const S = skin.bones[k];
  if (skin.drawFist) skin.drawFist(ctx, b[k], back, curInfo!); else defaultFist(ctx, b[k], back ? shade(S.color) : S.color, S.width / 2);
}
function foot(ctx: CanvasRenderingContext2D, skin: Skin, b: Bones, k: 'footF' | 'footB', back: boolean): void {
  const S = skin.bones[k];
  if (skin.drawFoot) skin.drawFoot(ctx, b[k], back, curInfo!); else defaultFoot(ctx, b[k], back ? shade(S.color) : S.color, S.width);
}
let curInfo: DrawInfo | null = null;

/** Draw a puppet with its feet at screen (x, y). Draw order per spec §9.2. */
export function drawPuppet(ctx: CanvasRenderingContext2D, skin: Skin, pose: Pose, x: number, y: number, facing: 1 | -1, opts: PuppetOpts = {}): void {
  const frame = opts.frame ?? 0;
  const b = solveBones(skin, pose, 1, frame, opts.extra ?? {});
  const pulseOn = opts.glow === true && frame % 60 < 30;
  outlineColor = pulseOn ? skin.accent : skin.outline;
  tint = opts.flash === 'hit' ? HIT_TINT : opts.flash === 'counter' ? COUNTER_TINT : null;
  const info: DrawInfo = { frame, meterFull: opts.meterFull ?? false, outline: outlineColor, jawOpen: opts.extra?.jaw ?? pose.a.jaw ?? 0, mood: opts.mood ?? 'normal' };
  curInfo = info;
  ctx.save();
  const sq = opts.squash ?? 0, sc = opts.scale ?? 1;
  const yw = opts.yaw ? yawScale(opts.yaw, facing) : null;
  const f = yw ? yw.facing : facing, ysx = yw ? yw.sx : 1;
  ctx.translate(x, y); ctx.scale(f * ysx * sc * (1 + sq), sc * (1 - sq));
  if (opts.spin) { ctx.translate(b.root.x0, b.root.y0); ctx.rotate(opts.spin * RAD); ctx.translate(-b.root.x0, -b.root.y0); }
  const order = drawOrder(opts.yaw ?? 0), swapped = order !== ORDER;
  for (let i = 0; i < order.length; i++) {
    switch (order[i]) {
      case 'scarf':
        if (skin.scarf) {
          const scf = skin.scarf;
          (['scarf4', 'scarf3', 'scarf2', 'scarf1'] as const).forEach((k, j) => { const s = b[k]; if (s) capsule(ctx, s, scf.width - j, shade(scf.color, 10 + j * 6)); });
        }
        break;
      case 'tail':
        if (skin.tail && b.tail) {
          const t = skin.tail, s = b.tail;
          const n = 5;
          for (let j = n - 1; j >= 0; j--) {
            const k0 = j / n, k1 = (j + 1) / n;
            capsule(ctx, { x0: s.x0 + (s.x1 - s.x0) * k0, y0: s.y0 + (s.y1 - s.y0) * k0, x1: s.x0 + (s.x1 - s.x0) * k1, y1: s.y0 + (s.y1 - s.y0) * k1 }, t.w0 + (t.w1 - t.w0) * k1, t.color);
          }
        }
        break;
      case 'drawBack': skin.drawBack?.(ctx, b, info); break;
      // Shading follows the slot (far = shaded), so a swapped near limb reads as the far one.
      case 'armB': if (swapped) { limb(ctx, skin, b, 'uArmF', true); limb(ctx, skin, b, 'fArmF', true); fist(ctx, skin, b, 'fistF', true); } else { limb(ctx, skin, b, 'uArmB', true); limb(ctx, skin, b, 'fArmB', true); fist(ctx, skin, b, 'fistB', true); } break;
      case 'legB': if (swapped) { limb(ctx, skin, b, 'thighF', true); limb(ctx, skin, b, 'shinF', true); foot(ctx, skin, b, 'footF', true); } else { limb(ctx, skin, b, 'thighB', true); limb(ctx, skin, b, 'shinB', true); foot(ctx, skin, b, 'footB', true); } break;
      case 'torso': skin.drawTorso(ctx, b, info); break;
      case 'legF': if (swapped) { limb(ctx, skin, b, 'thighB', false); limb(ctx, skin, b, 'shinB', false); foot(ctx, skin, b, 'footB', false); } else { limb(ctx, skin, b, 'thighF', false); limb(ctx, skin, b, 'shinF', false); foot(ctx, skin, b, 'footF', false); } break;
      case 'head': skin.drawHead(ctx, b, info); break;
      case 'armF': if (swapped) { limb(ctx, skin, b, 'uArmB', false); limb(ctx, skin, b, 'fArmB', false); fist(ctx, skin, b, 'fistB', false); } else { limb(ctx, skin, b, 'uArmF', false); limb(ctx, skin, b, 'fArmF', false); fist(ctx, skin, b, 'fistF', false); } break;
      case 'drawFront': skin.drawFront?.(ctx, b, info); break;
    }
  }
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
