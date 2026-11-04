import type { AnyBone } from './skins/types.js';

/** Local angles in degrees (spec §9.3). Omitted bones fall back to `idle`. */
export interface Pose { root: { dx: number; dy: number }; a: Partial<Record<AnyBone, number>> }

const COLS = ['torso', 'head', 'uArmF', 'fArmF', 'uArmB', 'fArmB', 'thighF', 'shinF', 'thighB', 'shinB'] as const;
type Row = [dy: number, ...angles: number[]];
const row = (r: Row, dx = 0): Pose => {
  const a: Partial<Record<AnyBone, number>> = { fistF: 0, fistB: 0, footF: -90, footB: -90 };
  COLS.forEach((bone, i) => { a[bone] = r[i + 1] ?? 0; });
  return { root: { dx, dy: r[0] }, a };
};
const derive = (base: Pose, a: Partial<Record<AnyBone, number>>, dy = base.root.dy, dx = base.root.dx): Pose =>
  ({ root: { dx, dy }, a: { ...base.a, ...a } });

// Shared table, verbatim from spec §9.3.
const S = {
  idle: row([0, 8, -8, 140, -110, 160, -120, 160, 20, 200, -10]),
  idle2: row([-1, 10, -8, 138, -112, 158, -122, 160, 20, 200, -10]),
  walk1: row([0, 10, -8, 140, -110, 160, -120, 145, 25, 210, -5]),
  walk2: row([-2, 10, -8, 140, -110, 160, -120, 175, 10, 190, -20]),
  crouch: row([30, 25, -20, 125, -100, 150, -115, 110, 80, 200, -60]),
  jumpUp: row([-6, 5, -5, 120, -90, 150, -110, 120, 60, 190, -40]),
  jumpTuck: row([0, 20, -15, 110, -120, 140, -130, 90, 100, 120, 80]),
  blockHigh: row([0, -5, 0, 60, -100, 80, -110, 165, 15, 200, -10]),
  blockLow: row([30, 15, -10, 80, -110, 100, -120, 110, 80, 200, -60]),
  hitHigh: row([0, -25, -20, 200, -20, 210, -20, 170, 10, 205, -10]),
  hitLow: row([4, 30, 20, 170, -30, 190, -30, 170, 10, 200, 0]),
  fall: row([-10, -70, -20, 230, 0, 250, 0, 140, 30, 160, 20]),
  lying: row([46, -90, 0, 260, 0, 280, 0, 90, 0, 95, 0]),
  jabWind: row([0, 5, -5, 140, -120, 160, -120, 160, 20, 200, -10]),
  jab: row([0, 15, -10, 92, 0, 165, -125, 160, 20, 205, -10]),
  strongWind: row([0, -10, 5, 200, -90, 140, -100, 160, 20, 200, -10]),
  strong: row([0, 25, -15, 85, -2, 190, -90, 150, 25, 215, -10]),
  lowKickWind: row([0, -5, 0, 140, -110, 160, -120, 120, 70, 200, -10]),
  lowKick: row([0, -15, 5, 150, -110, 170, -120, 110, 10, 200, -10]),
  roundWind: row([0, -10, 5, 150, -110, 170, -120, 70, 100, 195, -5]),
  roundhouse: row([0, -30, 15, 170, -100, 190, -110, 80, 5, 195, -5]),
  crJab: row([30, 30, -20, 95, 0, 150, -115, 110, 80, 200, -60]),
  uppercutWind: row([32, 20, -10, 170, -140, 150, -110, 110, 80, 200, -60]),
  uppercut: row([-4, 5, -15, 20, -10, 170, -100, 160, 15, 200, -10]),
  crShort: row([34, 20, -15, 125, -100, 150, -115, 95, 0, 200, -60]),
  sweep: row([40, 45, -30, 160, -60, 200, -40, 95, -5, 200, -70]),
  airPunch: row([0, 15, -10, 110, -10, 150, -110, 120, 60, 190, -40]),
  airKick: row([0, -10, 5, 140, -110, 160, -120, 115, 0, 170, 60]),
  airHeavy: row([0, 25, -10, 135, -40, 120, -40, 100, 20, 150, 60]),
  throwGrab: row([0, 20, -10, 85, -10, 95, -15, 155, 20, 210, -10]),
  throwToss: row([0, -20, 10, 10, -10, 20, -10, 165, 15, 205, -10]),
  cast: row([0, 20, -10, 88, -2, 100, -10, 145, 25, 220, -10]),
  castWind: row([0, -10, 5, 220, -60, 230, -60, 160, 20, 200, -10]),
  rise: row([-10, 0, -20, 0, -5, 170, -100, 160, 20, 170, 40]),
  spin: row([20, 120, 0, 60, -150, 80, -150, 60, 140, 80, 140]),
  victory: row([0, 0, -10, 30, -20, 200, -150, 170, 10, 195, -5]),
};

// Character move poses named by MoveDefs in packages/shared/src/chars/*.ts, derived from the shared table.
export const POSES: Record<string, Pose> = {
  ...S,
  // Bolt
  demolitionWind: S.strongWind,
  demolition: derive(S.strong, { torso: 35, uArmB: 80, fArmB: -5 }),
  // Volt
  slide: derive(S.sweep, { torso: -30, head: 20, thighF: 80, shinF: 0, thighB: 120, shinB: 30 }, 36),
  whipWind: S.castWind,
  whip: derive(S.cast, { uArmF: 95, fArmF: 0, uArmB: 200 }),
  overloadWind: S.crouch,
  overload: derive(S.victory, { uArmF: 10, fArmF: -10, uArmB: -10, fArmB: 10 }, -4),
  // Chompa
  biteWind: derive(S.jabWind, { torso: 0, head: -20, jaw: 35 }),
  bite: derive(S.jab, { torso: 30, head: 30, jaw: 35 }),
  chompWind: derive(S.strongWind, { head: -20, jaw: 35 }),
  chomp: derive(S.strong, { torso: 40, head: 25, jaw: 10 }),
  tailWhipWind: derive(S.idle, { torso: 60 }),
  tailWhip: derive(S.idle, { torso: 160, head: 0 }),
  tailSweepWind: S.crouch,
  tailSweep: derive(S.sweep, { torso: 120 }),
  bellyBounceWind: derive(S.idle, { torso: -25, head: 10 }),
  bellyBounce: derive(S.idle, { torso: -40, head: 25, thighF: 140, shinF: 30 }),
  gulpWind: S.throwGrab,
  gulp: derive(S.throwGrab, { torso: 35, head: 25, jaw: 35 }),
  ballWind: S.crouch,
  ball: S.spin,
  // Kaze
  spinKickWind: derive(S.roundWind, { torso: -60 }),
  spinKick: derive(S.roundhouse, { torso: -45, head: 20, thighF: 75, shinF: 0 }),
  cartwheel: derive(S.jumpTuck, { torso: 160, uArmF: 20, uArmB: 30, thighF: 40, shinF: 0 }),
  throwStarWind: S.castWind,
  throwStar: derive(S.cast, { uArmF: 80, fArmF: 10 }),
  smoke: derive(S.crouch, { uArmF: 40, fArmF: -60 }),
  craneWind: derive(S.crouch, { thighF: 70, shinF: 110 }),
  crane: derive(S.rise, { thighF: 60, shinF: 0, uArmF: 60, fArmF: -20 }),
  shadowDash: derive(S.strong, { torso: 45, uArmB: 230, thighF: 120, thighB: 230 }),
  // Bao
  palmWind: derive(S.strongWind, { fArmF: -120 }),
  palm: derive(S.strong, { uArmF: 88, fArmF: -30, torso: 20 }),
  bellyBumpWind: derive(S.crouch, { torso: 0 }),
  bellyBump: derive(S.uppercut, { torso: -20, uArmF: 150, fArmF: -100 }, 0),
  hop: derive(S.jumpTuck, { torso: 35 }),
  counterStance: derive(S.blockHigh, { uArmF: 100, fArmF: -80, uArmB: 30, fArmB: -40, thighF: 140, shinF: 40 }, 6),
  dumplingWind: derive(S.idle, { uArmF: 40, fArmF: -120 }),
  dumpling: derive(S.cast, { uArmF: 95, fArmF: -10, uArmB: 110, fArmB: -20 }),
};

/** Wind-up key for a pose: `<pose>Wind`, plus the spec's `roundhouse` → `roundWind` spelling. */
export function windOf(pose: string): string {
  if (pose === 'roundhouse') return 'roundWind';
  return POSES[`${pose}Wind`] ? `${pose}Wind` : pose;
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const idle = S.idle.a;
  const out: Pose = { root: { dx: a.root.dx + (b.root.dx - a.root.dx) * t, dy: a.root.dy + (b.root.dy - a.root.dy) * t }, a: {} };
  const keys = new Set([...Object.keys(a.a), ...Object.keys(b.a)]) as Set<AnyBone>;
  for (const k of keys) {
    const va = a.a[k] ?? idle[k] ?? 0, vb = b.a[k] ?? idle[k] ?? 0;
    out.a[k] = va + (vb - va) * t;
  }
  return out;
}

export function getPose(name: string): Pose { return POSES[name] ?? S.idle; }
