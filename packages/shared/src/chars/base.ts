// Base normals + builders (docs/characters.md §1). Integers only.
import type { Box, HitDef, Level, MoveDef, ProjectileDef, Velocity } from "./types.js";

export const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });

/** Special defaults (characters.md §1): blockstun 16, chip = 10% dmg (pass explicitly), hitstop 11, pushback 1500, meterOnHit 30, mid, no KD. */
export const SPECIAL_DEFAULTS = { blockstun: 16, hitstop: 11, pushback: 1500, meterOnHit: 30, level: "mid" as Level, knockdown: false };

/**
 * TODO(S3 gap): characters.md gives no hitstun for some command normals / multi-hit specials / supers.
 * Provisional rule: hitstun = blockstun + 4 (matches the heavy base normals). Confirm with spec owner.
 */
export const PROVISIONAL_HITSTUN_OVER_BLOCKSTUN = 4;

export type HitInit = Pick<HitDef, "frames" | "box" | "damage" | "chip"> & Partial<HitDef>;
/** Hit with special defaults for unlisted fields. */
export function hit(h: HitInit): HitDef {
  const blockstun = h.blockstun ?? SPECIAL_DEFAULTS.blockstun;
  return {
    hitstun: blockstun + PROVISIONAL_HITSTUN_OVER_BLOCKSTUN,
    hitstop: SPECIAL_DEFAULTS.hitstop, pushback: SPECIAL_DEFAULTS.pushback,
    level: SPECIAL_DEFAULTS.level, knockdown: SPECIAL_DEFAULTS.knockdown,
    launch: null, meterOnHit: SPECIAL_DEFAULTS.meterOnHit,
    ...h, blockstun,
  };
}

export type ProjInit = Pick<ProjectileDef, "spawnFrame" | "offset" | "vx" | "w" | "h" | "lifetime" | "damage" | "chip" | "kind"> & Partial<ProjectileDef>;
export function proj(p: ProjInit): ProjectileDef {
  const blockstun = p.blockstun ?? SPECIAL_DEFAULTS.blockstun;
  return {
    vy: 0, gravity: 0, hits: 1, hitInterval: 0,
    hitstun: blockstun + PROVISIONAL_HITSTUN_OVER_BLOCKSTUN,
    hitstop: SPECIAL_DEFAULTS.hitstop, pushback: SPECIAL_DEFAULTS.pushback,
    level: SPECIAL_DEFAULTS.level, knockdown: SPECIAL_DEFAULTS.knockdown,
    meterOnHit: SPECIAL_DEFAULTS.meterOnHit, explodeOnGround: false,
    ...p, blockstun,
  };
}

export type MoveInit = Pick<MoveDef, "id" | "kind" | "name" | "input" | "startup" | "active" | "recovery"> & Partial<MoveDef>;
/** Full MoveDef with neutral defaults for unset fields. */
export function move(m: MoveInit): MoveDef {
  return {
    hits: [], projectile: null, velocities: [] as Velocity[], invuln: [], hurtExtend: null,
    cancelInto: [], airborneFrames: null, landingRecovery: 0, pose: m.id, sfx: m.id,
    heal: 0, grab: null, counter: null, gravityScale: 100, lockOnHit: null,
    ...m,
  };
}

type Btn = "LP" | "HP" | "LK" | "HK";
type Stance = "stand" | "crouch" | "air";
interface Row { id: string; name: string; btn: Btn; stance: Stance; s: number; a: number; r: number; dmg: number; chip: number; hs: number; bs: number; level: Level; b: Box; push: number; kd: boolean; cancel: MoveDef["cancelInto"]; pose: string; ext: Box | null }
const S: MoveDef["cancelInto"] = ["special", "super"];
const SC: MoveDef["cancelInto"] = ["special", "super", "chain"];
const ROWS: Row[] = [
  { id: "5LP", name: "Stand Light Punch", btn: "LP", stance: "stand", s: 4, a: 2, r: 7, dmg: 30, chip: 0, hs: 12, bs: 9, level: "mid", b: box(20, 72, 40, 16), push: 900, kd: false, cancel: SC, pose: "jab", ext: box(20, 70, 30, 20) },
  { id: "5HP", name: "Stand Heavy Punch", btn: "HP", stance: "stand", s: 7, a: 3, r: 18, dmg: 80, chip: 8, hs: 19, bs: 15, level: "mid", b: box(20, 66, 52, 22), push: 1600, kd: false, cancel: S, pose: "strong", ext: box(20, 64, 45, 26) },
  { id: "5LK", name: "Stand Light Kick", btn: "LK", stance: "stand", s: 5, a: 3, r: 9, dmg: 35, chip: 0, hs: 13, bs: 10, level: "mid", b: box(15, 36, 50, 18), push: 1000, kd: false, cancel: [], pose: "lowKick", ext: box(15, 30, 40, 24) },
  { id: "5HK", name: "Stand Heavy Kick", btn: "HK", stance: "stand", s: 9, a: 3, r: 20, dmg: 85, chip: 8, hs: 20, bs: 16, level: "mid", b: box(20, 58, 60, 22), push: 1800, kd: false, cancel: [], pose: "roundhouse", ext: box(20, 50, 55, 30) },
  { id: "2LP", name: "Crouch Light Punch", btn: "LP", stance: "crouch", s: 4, a: 2, r: 7, dmg: 25, chip: 0, hs: 11, bs: 9, level: "mid", b: box(15, 44, 43, 14), push: 900, kd: false, cancel: SC, pose: "crJab", ext: box(15, 40, 35, 20) },
  { id: "2HP", name: "Crouch Heavy Punch", btn: "HP", stance: "crouch", s: 6, a: 4, r: 20, dmg: 75, chip: 7, hs: 19, bs: 15, level: "mid", b: box(0, 50, 50, 70), push: 1400, kd: false, cancel: S, pose: "uppercut", ext: box(0, 50, 40, 60) },
  { id: "2LK", name: "Crouch Light Kick", btn: "LK", stance: "crouch", s: 5, a: 2, r: 10, dmg: 25, chip: 0, hs: 11, bs: 9, level: "low", b: box(20, 0, 50, 16), push: 900, kd: false, cancel: S, pose: "crShort", ext: box(20, 0, 40, 18) },
  // 2HK hitstun "—" in characters.md: irrelevant (always knockdown) → 0.
  { id: "2HK", name: "Crouch Heavy Kick", btn: "HK", stance: "crouch", s: 9, a: 3, r: 22, dmg: 75, chip: 7, hs: 0, bs: 14, level: "low", b: box(20, 0, 70, 14), push: 1200, kd: true, cancel: [], pose: "sweep", ext: box(20, 0, 60, 18) },
  { id: "j.LP", name: "Jump Light Punch", btn: "LP", stance: "air", s: 4, a: 8, r: 0, dmg: 40, chip: 4, hs: 12, bs: 9, level: "mid", b: box(10, 30, 35, 20), push: 800, kd: false, cancel: [], pose: "airPunch", ext: null },
  { id: "j.HP", name: "Jump Heavy Punch", btn: "HP", stance: "air", s: 7, a: 5, r: 0, dmg: 80, chip: 8, hs: 18, bs: 14, level: "mid", b: box(10, 10, 50, 30), push: 1200, kd: false, cancel: [], pose: "airHeavy", ext: null },
  { id: "j.LK", name: "Jump Light Kick", btn: "LK", stance: "air", s: 5, a: 8, r: 0, dmg: 40, chip: 4, hs: 12, bs: 9, level: "mid", b: box(10, 10, 45, 24), push: 800, kd: false, cancel: [], pose: "airKick", ext: null },
  { id: "j.HK", name: "Jump Heavy Kick", btn: "HK", stance: "air", s: 8, a: 5, r: 0, dmg: 85, chip: 8, hs: 18, bs: 14, level: "mid", b: box(15, 15, 55, 22), push: 1300, kd: false, cancel: [], pose: "airKick", ext: null },
];

const isLight = (b: string): boolean => b === "LP" || b === "LK";
export const LANDING_RECOVERY_ATTACK = 4; // mirrors spec §4 constant (sim/constants.ts lands in S4)

function fromRow(r: Row): MoveDef {
  const light = isLight(r.btn);
  return move({
    id: r.id, kind: "normal", name: r.name,
    input: { motion: "none", button: r.btn, dir: null, stance: r.stance },
    startup: r.s, active: r.a, recovery: r.r,
    hits: [{
      frames: [r.s + 1, r.s + r.a], box: r.b, damage: r.dmg, chip: r.chip,
      hitstun: r.hs, blockstun: r.bs, hitstop: light ? 8 : 11, pushback: r.push,
      level: r.level, knockdown: r.kd, launch: null, meterOnHit: light ? 20 : 40,
    }],
    hurtExtend: r.ext, cancelInto: r.cancel,
    landingRecovery: r.stance === "air" ? LANDING_RECOVERY_ATTACK : 0,
    pose: r.pose, sfx: light ? "swingLight" : "swingHeavy",
  });
}

/** Normal throw: range/damage/tech come from sim constants (THROW_*), so grab stays null. */
const THROW: MoveDef = move({
  id: "throw", kind: "throw", name: "Throw",
  input: { motion: "none", button: "LP+LK", dir: null, stance: "stand" },
  startup: 5, active: 1, recovery: 22, pose: "throwGrab", sfx: "throw",
});

export const BASE_IDS = [...ROWS.map((r) => r.id), "throw"] as const;
export const BASE_NORMALS: Readonly<Record<string, MoveDef>> = Object.fromEntries([...ROWS.map((r) => [r.id, fromRow(r)] as const), ["throw", THROW] as const]);

export type NormalOverrides = Partial<Omit<MoveDef, "id">> & { hit?: Partial<HitDef> };
/**
 * normal(baseId, overrides): shallow-merge overrides into the base template; `hits` replaced wholesale if given.
 * Convenience: `hit` patches hits[0] (and startup/active changes re-derive hits[0].frames when hits not given).
 */
export function normal(id: string, overrides: NormalOverrides = {}): MoveDef {
  const base = BASE_NORMALS[id];
  if (!base) throw new Error(`unknown base normal ${id}`);
  const { hit: hitPatch, ...rest } = overrides;
  const merged: MoveDef = { ...base, ...rest };
  if (!rest.hits && base.hits[0]) {
    const h0 = base.hits[0];
    merged.hits = [{ ...h0, frames: [merged.startup + 1, merged.startup + merged.active], ...hitPatch }];
  }
  return merged;
}

/** Variant ids for LP/HP (or LK/HK) specials: `<id>.L`, `<id>.H`. */
export const L = ".L", H = ".H";

export type Variant = "L" | "H";
/** Build the light/heavy variant pair of a special. */
export const pair = (make: (v: Variant) => MoveDef): MoveDef[] => [make("L"), make("H")];
export const lh = <T>(v: Variant, l: T, h: T): T => (v === "L" ? l : h);

/** Default character physics (characters.md §1). */
export const DEFAULT_PHYSICS = {
  walkFwd: 350, walkBack: 280, jumpVy: 1650, jumpVx: 380,
  dashFwd: { frames: 16, speed: 900 }, dashBack: { frames: 20, speed: 850, invuln: 8 },
  pushWidth: 40, airJumpMax: 0,
  hurt: { stand: box(-22, 0, 44, 110), crouch: box(-24, 0, 48, 70), air: box(-20, 10, 40, 90) },
};
export const STD_NORMAL_IDS = ["5LP", "5HP", "5LK", "5HK", "2LP", "2HP", "2LK", "2HK", "j.LP", "j.HP", "j.LK", "j.HK", "throw"];
