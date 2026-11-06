// CPU opponent (spec §11.6). Deterministic: integers only, its own rng (never MatchState.rng),
// reads the state, never mutates it, and returns plain input bytes that go through the normal parser.
import { CHARS } from "../chars/index.js";
import type { CharId, Level, MoveDef } from "../chars/types.js";
import { DOWN, HK, HP, LEFT, LK, LP, RIGHT, UP, type InputByte } from "../input/buttons.js";
import { METER_MAX } from "../sim/constants.js";
import { rngInt } from "../rng.js";
import type { Fighter, MatchState } from "../sim/types.js";

export type CpuDifficulty = "easy" | "normal" | "hard";
export const CPU_DIFFICULTIES: readonly CpuDifficulty[] = ["easy", "normal", "hard"];
export const CPU_DECIDE_EVERY = 6;
export const CPU_RNG_SALT = 0x9e3779b9;
/** Spec §11.6 per-difficulty table. */
export const CPU_TUNING: Readonly<Record<CpuDifficulty, { reaction: number; blockPct: number; combos: boolean }>> = {
  easy: { reaction: 24, blockPct: 30, combos: false },
  normal: { reaction: 14, blockPct: 60, combos: true },
  hard: { reaction: 8, blockPct: 85, combos: true },
};

/** Plain-JSON CPU memory. Lives beside the match (local loop / server room), never inside MatchState. */
export interface CpuState {
  side: 0 | 1;
  difficulty: CpuDifficulty;
  rng: number;
  tick: number;
  macro: number[];       // queued relative bytes (see F/B below), consumed one per frame
  atkKey: number;        // frame the opponent's current attack started (-1 = none seen)
  atkBlock: boolean;     // block roll for that attack
  projRolled: boolean;   // a block roll exists for the current incoming projectile(s)
  projBlock: boolean;
}

/** cpuRng seed = match seed XOR 0x9e3779b9 (0 maps to 1, xorshift32 would freeze). */
export function cpuSeed(matchSeed: number): number { return ((matchSeed ^ CPU_RNG_SALT) >>> 0) || 1; }

export function createCpu(opts: { side: 0 | 1; difficulty: CpuDifficulty; matchSeed: number }): CpuState {
  return { side: opts.side, difficulty: opts.difficulty, rng: cpuSeed(opts.matchSeed), tick: 0, macro: [],
    atkKey: -1, atkBlock: false, projRolled: false, projBlock: false };
}

// Macro bytes are facing-relative: F/B are resolved against facing on the frame they are emitted.
const F = 1 << 8, B = 1 << 9;
const BTN: Readonly<Record<MoveDef["input"]["button"], number>> = { LP, HP, LK, HK, P: HP, K: HK, "LP+LK": LP | LK };
const SEQ: Readonly<Record<string, readonly number[]>> = {
  qcf: [DOWN, DOWN | F, F], qcb: [DOWN, DOWN | B, B], dp: [F, DOWN, DOWN | F],
  dqcf: [DOWN, DOWN | F, F, DOWN, DOWN | F, F], dd: [DOWN, 0, DOWN],
};

/** Input frames for a move (motion + button on the last frame; spin: 6,3,2,1,4,7,8 then button; charge: 42 back). */
export function macroFor(m: MoveDef): number[] {
  const btn = BTN[m.input.button];
  const mo = m.input.motion;
  if (mo === "spin") return [F, DOWN | F, DOWN, DOWN | B, B, UP | B, UP, btn];
  if (mo === "charge") return [...new Array<number>(42).fill(B), F | btn];
  if (mo === "none") {
    const d = m.input.dir === 6 ? F : m.input.dir === 3 ? DOWN | F : m.input.dir === 2 ? DOWN : 0;
    return [d | btn];
  }
  const seq = SEQ[mo] ?? [];
  return seq.map((b, i) => (i === seq.length - 1 ? b | btn : b));
}

const specials = (c: CharId): MoveDef[] => CHARS[c].moves.filter((m) => m.kind === "special" && m.input.stance === "stand");
const findAntiAir = (c: CharId): MoveDef | undefined => specials(c).find((m) => m.input.motion === "dp");
const findProjectile = (c: CharId): MoveDef | undefined =>
  specials(c).find((m) => m.projectile !== null && (m.input.motion === "qcf" || m.input.motion === "qcb"));
const findComboEnder = (c: CharId): MoveDef | undefined =>
  specials(c).find((m) => m.projectile === null && m.grab === null && m.counter === null && (m.input.motion === "qcf" || m.input.motion === "qcb"))
  ?? specials(c).find((m) => m.input.motion === "qcf" || m.input.motion === "qcb");
const findSuper = (c: CharId): MoveDef | undefined => CHARS[c].moves.find((m) => m.kind === "super");
const findGrab = (c: CharId): MoveDef | undefined => specials(c).find((m) => m.grab !== null);

const moveById = (c: CharId, id: string): MoveDef | undefined => CHARS[c].moves.find((m) => m.id === id);
// Style knobs (percent). TODO(tune): re-tune with TUNE_N=200 pnpm vitest run tests/unit/winrate.test.ts.
const KAZE_FAR_PROJ = 60, KAZE_DASH = 40, KAZE_OVERHEAD = 20, KAZE_LOW = 22;
const ACTIONABLE = ["idle", "walkF", "walkB", "crouch"];
const abs = (v: number): number => (v < 0 ? -v : v);
const pct = (cpu: CpuState, p: number): boolean => rngInt(cpu, 100) < p;

/** Resolve relative bits to an absolute byte for a fighter facing `facing`. */
function resolve(b: number, facing: 1 | -1): InputByte {
  let out = b & 0xff;
  if (b & F) out |= facing === 1 ? RIGHT : LEFT;
  if (b & B) out |= facing === 1 ? LEFT : RIGHT;
  return out;
}

/** Block byte against a source at world x `srcX` for an attack of `level` (crouch-back blocks mid and low). */
export function blockInput(me: Fighter, srcX: number, level: Level): InputByte {
  const away = srcX > me.x ? LEFT : srcX < me.x ? RIGHT : me.facing === 1 ? LEFT : RIGHT;
  return level === "overhead" ? away : away | DOWN;
}

/** Level of the next/current hit of the opponent's move, or null when it is not a strike. */
function threatLevel(opp: Fighter): Level | null {
  if (opp.state !== "attack" || !opp.move) return null;
  const m = CHARS[opp.char].moves.find((x) => x.id === opp.move);
  if (!m || m.hits.length === 0) return null;
  const next = m.hits.find((h) => opp.moveFrame <= h.frames[1]) ?? m.hits[m.hits.length - 1]!;
  return next.level;
}

/** Opponent projectile within 220 px moving toward me. */
function projectileThreat(s: MatchState, side: 0 | 1): boolean {
  const me = s.fighters[side];
  return s.projectiles.some((p) => p.owner !== side && abs(p.x - me.x) < 22000 && (p.x < me.x ? p.vx > 0 : p.vx < 0));
}

function decide(cpu: CpuState, s: MatchState): number[] {
  const me = s.fighters[cpu.side], opp = s.fighters[1 - cpu.side]!;
  const t = CPU_TUNING[cpu.difficulty];
  const dist = abs(opp.x - me.x);
  const toward = opp.x > me.x ? 1 : -1;
  const c = me.char;
  // Platforms: jump up toward an opponent standing on a higher platform; drop when the opponent is far below.
  // Recovery uses the character's "up SP" (a rising DP special) when it has one, else a plain jump.
  if (me.platform < 0 && opp.platform >= 0 && opp.y > me.y && dist <= 12000) {
    const rise = findAntiAir(c);
    return rise && t.combos ? macroFor(rise) : [UP, 0, 0, 0, 0, 0];
  }
  if (me.platform >= 0 && opp.platform < 0 && !opp.airborne && dist > 15000) return [DOWN, 0, DOWN, 0, 0, 0];
  // Super (one button for players; the CPU still plays the motion): meter full and the opponent in range.
  const sup = findSuper(c);
  if (sup && me.meter >= METER_MAX && dist < 20000 && (t.combos || opp.state === "hitstun")) return macroFor(sup);
  // Anti-air: opponent airborne, approaching, within 160 px.
  if (opp.airborne && dist < 16000 && opp.vx * toward < 0) {
    const bc = c === "bao" && t.combos && pct(cpu, 30) ? moveById(c, "bambooCounter.L") : undefined; // characters.md bot style
    if (bc) return macroFor(bc);
    const aa = findAntiAir(c);
    return aa && t.combos ? macroFor(aa) : [DOWN | HP];
  }
  if (dist > 26000) {
    const pr = findProjectile(c);
    if (pr && !s.projectiles.some((p) => p.owner === cpu.side) && pct(cpu, c === "kaze" ? KAZE_FAR_PROJ : 50)) return macroFor(pr);
    if (c === "kaze" && pct(cpu, KAZE_DASH)) return [F, 0, F, 0, 0, 0]; // rushdown: dash in
    return pct(cpu, 25) ? [F, 0, F, 0, 0, 0] : [F, F, F, F, F, F];
  }
  if (c === "kaze" && dist < 9000) {
    // Rushdown (characters.md bot style): mix the 6LK overhead and the 2LK low at close range, else fall through.
    const r = rngInt(cpu, 100);
    if (r < KAZE_OVERHEAD) return [F | LK];
    if (r < KAZE_OVERHEAD + KAZE_LOW) return [DOWN | LK, 0, 0, DOWN | LK];
  }
  if (dist >= 9000) {
    if (pct(cpu, 15)) return [UP | F, UP | F, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, HK];
    if (c === "volt" && pct(cpu, 30)) return [B, B, B, B, B, B]; // keepaway (characters.md bot style)
    return pct(cpu, 50) ? [HK] : [DOWN | HK];
  }
  // Close range.
  const grab = findGrab(c);
  if (grab && pct(cpu, 35)) return macroFor(grab);
  if (pct(cpu, 20)) return [LP | LK];
  if (!t.combos) return [LP];
  const ender = findComboEnder(c);
  const chain = [LP, 0, 0, 0, 0, LP, 0, 0, 0, 0, DOWN | LK, 0];
  return ender ? [...chain, ...macroFor(ender)] : chain;
}

/** One frame of CPU input. Call exactly once per sim frame, before step(), with the pre-step state. */
export function cpuInput(cpu: CpuState, s: MatchState): InputByte {
  const me = s.fighters[cpu.side], opp = s.fighters[1 - cpu.side]!;
  cpu.tick++;
  if (s.phase !== "fight") { cpu.macro = []; cpu.atkKey = -1; return 0; }
  const t = CPU_TUNING[cpu.difficulty];
  // Defence (reacts every frame): roll once per opponent attack, block after the reaction delay.
  const lvl = threatLevel(opp);
  if (lvl !== null) {
    const key = s.frame - opp.moveFrame;
    if (key !== cpu.atkKey) { cpu.atkKey = key; cpu.atkBlock = pct(cpu, t.blockPct); }
    if (cpu.atkBlock && opp.moveFrame + 1 >= t.reaction && me.state !== "attack") { cpu.macro = []; return blockInput(me, opp.x, lvl); }
  } else cpu.atkKey = -1;
  if (projectileThreat(s, cpu.side)) {
    if (!cpu.projRolled) { cpu.projRolled = true; cpu.projBlock = pct(cpu, t.blockPct); }
    if (cpu.projBlock && me.state !== "attack") { cpu.macro = []; return blockInput(me, opp.x, "mid"); }
  } else cpu.projRolled = false;
  if (cpu.macro.length > 0) return resolve(cpu.macro.shift()!, me.facing);
  if (cpu.tick % CPU_DECIDE_EVERY !== 0 || !ACTIONABLE.includes(me.state)) return 0;
  if (lvl !== null) return 0; // opponent mid-attack and no block roll: do not throw out new actions
  cpu.macro = decide(cpu, s);
  return resolve(cpu.macro.shift() ?? 0, me.facing);
}

/** Training "block all" dummy: correct-height block against the current strike or incoming projectile, else neutral. */
export function guardInput(s: MatchState, side: 0 | 1): InputByte {
  const me = s.fighters[side], opp = s.fighters[1 - side]!;
  const lvl = threatLevel(opp);
  if (lvl !== null) return blockInput(me, opp.x, lvl);
  return projectileThreat(s, side) ? blockInput(me, opp.x, "mid") : 0;
}
