// Hit detection and resolution (spec §8.3). Integers only.
import { CHARS } from "../chars/index.js";
import type { Box, HitDef, MoveDef } from "../chars/types.js";
import { PX, clamp, idiv } from "../fixed.js";
import { numpad } from "../input/buttons.js";
import { inputAt } from "../input/history.js";
import {
  CHIP_KO_ALLOWED, COMBO_SCALING, CORNER_PUSH_TRANSFER, JUGGLE_FALL_VX, JUGGLE_FALL_VY,
  KNOCKDOWN_FRAMES, METER_DEFENDER_PERCENT, THROW_DAMAGE, THROW_RANGE,
} from "./constants.js";
import {
  THROW_HOLD_FRAMES, addMeter, curMove, pushStep, setState, techThrow, totalFrames,
} from "./fighter.js";
import { WALL_MAX, WALL_MIN } from "./physics.js";
import type { Fighter, FxEvent, MatchState } from "./types.js";

/** Throw lands the defender this far from the thrower (spec §8.3). */
export const THROW_LAND_OFFSET = 8000;
/** moveHitMask bit used on a throw/grab to remember "thrown backward" (throws have no hits[]). */
const BACK_THROW_BIT = 2;
const PARRY_HITSTOP = 10;

export interface WorldBox { left: number; right: number; bottom: number; top: number }

export function worldBox(f: Fighter, b: Box): WorldBox {
  const left = f.x + (f.facing === 1 ? b.x : -(b.x + b.w)) * PX;
  const bottom = f.y + b.y * PX;
  return { left, right: left + b.w * PX, bottom, top: bottom + b.h * PX };
}
export const overlaps = (p: WorldBox, q: WorldBox): boolean =>
  p.left < q.right && q.left < p.right && p.bottom < q.top && q.bottom < p.top;

/** Hurtboxes: state box ∪ own move's hurtExtend during active+recovery (rule 2). */
export function hurtboxes(f: Fighter): WorldBox[] {
  const h = CHARS[f.char].hurt;
  const out = [worldBox(f, f.airborne ? h.air : f.crouching ? h.crouch : h.stand)];
  const m = f.state === "attack" ? curMove(f) : null;
  if (m?.hurtExtend && f.moveFrame > m.startup && f.moveFrame <= totalFrames(m)) out.push(worldBox(f, m.hurtExtend));
  return out;
}

/** Combo scaling (rule 6): COMBO_SCALING[min(hitIndex,7)], minimum 1. */
export function scaledDamage(damage: number, comboHits: number): number {
  const scale = COMBO_SCALING[comboHits < 7 ? comboHits : 7] ?? 30;
  const d = idiv(damage * scale, 100);
  return d < 1 ? 1 : d;
}

function moveInvuln(f: Fighter, kinds: readonly string[]): boolean {
  if (kinds.includes(f.invuln)) return true;
  const m = f.state === "attack" ? curMove(f) : null;
  return !!m && m.invuln.some((w) => kinds.includes(w.kind) && f.moveFrame >= w.from && f.moveFrame <= w.to);
}

const NO_BLOCK_STATES = ["attack", "hitstun", "jumpSquat", "dashF", "dashB", "juggle", "thrown", "throwing", "techSep", "knockdown", "getup", "ko"];

/** Rule 4: grounded, allowed state, holding back away from the attacker; low needs 1, overhead needs 4. */
export function blocks(d: Fighter, a: Fighter, h: HitDef): boolean {
  if (d.airborne || NO_BLOCK_STATES.includes(d.state)) return false;
  const towardA = a.x > d.x ? 1 : a.x < d.x ? -1 : d.facing;
  const dir = numpad(inputAt(d, 0), towardA);
  if (h.level === "low") return dir === 1;
  if (h.level === "overhead") return dir === 4;
  return dir === 1 || dir === 4;
}

interface Pending { k: number; h: HitDef; m: MoveDef; blocked: boolean; counter: boolean; parry: boolean }

/** Evaluate attacker i against the pre-apply state (rules 1-4). */
function detect(s: MatchState, i: number): Pending | null {
  const a = s.fighters[i]!, d = s.fighters[1 - i]!;
  if (a.hitstop > 0 || a.state !== "attack") return null;
  const m = curMove(a);
  if (!m || m.kind === "throw" || m.grab) return null;
  for (let k = 0; k < m.hits.length; k++) {
    const h = m.hits[k]!;
    if (a.moveFrame < h.frames[0] || a.moveFrame > h.frames[1] || (a.moveHitMask & (1 << k)) !== 0) continue;
    if (d.state === "knockdown" || d.state === "getup" || d.state === "ko") return null;
    if (moveInvuln(d, ["full", "strike"])) return null;
    if (d.state === "juggle" && h.launch === null) return null; // juggle limit
    const hb = worldBox(a, h.box);
    if (!hurtboxes(d).some((hu) => overlaps(hb, hu))) return null;
    const dm = d.state === "attack" ? curMove(d) : null;
    const parry = !!(d.counterArmed && dm?.counter && d.moveFrame >= dm.counter.from && d.moveFrame <= dm.counter.to);
    const blocked = !parry && blocks(d, a, h);
    const counter = !parry && !blocked && !!dm && d.moveFrame <= dm.startup;
    return { k, h, m, blocked, counter, parry };
  }
  return null;
}

function event(s: MatchState, kind: FxEvent["kind"], by: 0 | 1, d: Fighter, strength: 0 | 1 | 2): void {
  s.events.push({ frame: s.frame, kind, x: d.x, y: d.y + 60 * PX, strength, by });
}

function setPushback(a: Fighter, d: Fighter, amount: number): void {
  const side = d.x > a.x ? 1 : d.x < a.x ? -1 : a.facing;
  d.pushRemain = side * amount; d.pushPerFrame = pushStep(d.pushRemain);
}

function toJuggle(f: Fighter, vx: number, vy: number): void {
  f.state = "juggle"; f.stateFrame = 1; f.move = null; f.moveFrame = 0; f.cancelOk = false; f.counterArmed = false;
  f.airborne = true; f.vx = vx; f.vy = vy; f.stun = 0; f.pushRemain = 0; f.pushPerFrame = 0;
}

function apply(s: MatchState, i: 0 | 1, p: Pending): void {
  const a = s.fighters[i], d = s.fighters[1 - i]!;
  const { h, m } = p;
  a.moveHitMask |= 1 << p.k;
  if (p.parry) {
    const dm = curMove(d)!;
    a.hp -= dm.counter!.damage; if (a.hp < 0) a.hp = 0;
    toJuggle(a, JUGGLE_FALL_VX * d.facing, JUGGLE_FALL_VY);
    d.hitstop = PARRY_HITSTOP; d.cancelOk = false;
    event(s, "parry", (1 - i) as 0 | 1, a, 2);
    return;
  }
  const stop = h.hitstop;
  a.hitstop = a.hitstop > stop ? a.hitstop : stop;
  d.hitstop = d.hitstop > stop ? d.hitstop : stop;
  if (m.cancelInto.length > 0) a.cancelOk = true;
  const strength: 0 | 1 = stop >= 11 ? 1 : 0;
  d.move = null; d.moveFrame = 0; d.cancelOk = false; d.counterArmed = false; d.vx = 0;
  if (p.blocked) {
    let hp = d.hp - h.chip;
    if (!CHIP_KO_ALLOWED && hp < 1) hp = d.hp < 1 ? d.hp : 1;
    d.hp = hp;
    d.state = "blockstun"; d.stateFrame = 1; d.stun = h.blockstun;
    d.crouching = h.level === "low" || numpad(inputAt(d, 0), d.facing) <= 3;
    setPushback(a, d, h.pushback);
    addMeter(a, idiv(h.meterOnHit, 2));
    event(s, "block", i, d, strength);
    return;
  }
  let dmg = scaledDamage(h.damage, d.comboHits);
  if (p.counter) dmg = idiv(dmg * 12, 10);
  d.hp -= dmg; if (d.hp < 0) d.hp = 0;
  d.comboHits++;
  addMeter(a, h.meterOnHit);
  addMeter(d, idiv(dmg * METER_DEFENDER_PERCENT, 100));
  if (d.airborne || h.knockdown || h.launch) {
    toJuggle(d, (h.launch ? h.launch.vx : JUGGLE_FALL_VX) * a.facing, h.launch ? h.launch.vy : JUGGLE_FALL_VY);
  } else {
    d.state = "hitstun"; d.stateFrame = 1; d.stun = h.hitstun + (p.counter ? 2 : 0);
    setPushback(a, d, h.pushback);
  }
  event(s, p.counter ? "counter" : "hit", i, d, p.counter ? 2 : strength);
}

// ---- throws and command grabs ----

const NO_THROW_STATES = ["hitstun", "blockstun", "knockdown", "getup", "thrown", "throwing", "techSep", "juggle", "ko"];

/** Attacker i's throw/grab connects this frame (pre-apply state). */
function throwConnects(s: MatchState, i: number): boolean {
  const a = s.fighters[i]!, d = s.fighters[1 - i]!;
  if (a.hitstop > 0 || a.state !== "attack") return false;
  const m = curMove(a);
  if (!m || (m.kind !== "throw" && !m.grab) || (a.moveHitMask & 1) !== 0) return false;
  // Normal throw: only frame THROW_STARTUP+1 (= startup+1). Command grab: its whole active window.
  const last = m.grab ? m.startup + m.active : m.startup + 1;
  if (a.moveFrame < m.startup + 1 || a.moveFrame > last) return false;
  if (d.airborne || NO_THROW_STATES.includes(d.state) || moveInvuln(d, ["full"])) return false;
  const dx = d.x - a.x;
  return (dx < 0 ? -dx : dx) <= (m.grab ? m.grab.range : THROW_RANGE);
}

function grabStart(a: Fighter, d: Fighter): void {
  // "Holding back on start" = the frame the throw move began (moveFrame 1).
  const back = numpad(inputAt(a, a.moveFrame - 1), a.facing);
  a.moveHitMask |= 1 | (back === 4 || back === 1 ? BACK_THROW_BIT : 0);
  a.state = "throwing"; a.stateFrame = 1; a.vx = 0; a.cancelOk = false;
  d.move = null; d.moveFrame = 0; d.cancelOk = false; d.counterArmed = false;
  d.state = "thrown"; d.stateFrame = 1; d.vx = 0; d.stun = 0; d.pushRemain = 0; d.pushPerFrame = 0;
}

function grabFinish(s: MatchState, i: 0 | 1): void {
  const a = s.fighters[i], d = s.fighters[1 - i]!;
  const m = curMove(a);
  const dir = (a.moveHitMask & BACK_THROW_BIT) !== 0 ? -a.facing : a.facing;
  const dmg = m?.grab ? m.grab.damage : THROW_DAMAGE; // throws are not combo-scaled
  d.hp -= dmg; if (d.hp < 0) d.hp = 0;
  addMeter(d, idiv(dmg * METER_DEFENDER_PERCENT, 100));
  if (m?.grab) {
    toJuggle(d, m.grab.throwVx * dir, m.grab.throwVy);
  } else {
    d.x = clamp(a.x + dir * THROW_LAND_OFFSET, WALL_MIN, WALL_MAX);
    d.state = "knockdown"; d.stateFrame = 1; d.stun = KNOCKDOWN_FRAMES; d.invuln = "full"; d.invulnFrames = KNOCKDOWN_FRAMES + 1;
    d.move = null;
  }
  // TODO(S6): gulpGrab-specific sequence may keep the attacker in its move; here the thrower recovers at once.
  a.move = null; a.moveFrame = 0; a.moveHitMask = 0; setState(a, "idle");
  event(s, "throw", i, d, 2);
}

/** Spec §8 `hits(s)`: throws first (a thrown fighter's strike is dropped), then strikes evaluated together (trades). */
export function hits(s: MatchState): void {
  const [f0, f1] = s.fighters;
  for (const i of [0, 1] as const) {
    const a = s.fighters[i], d = s.fighters[1 - i]!;
    if (a.state === "throwing" && d.state === "thrown" && d.stateFrame >= THROW_HOLD_FRAMES) grabFinish(s, i);
  }
  const t0 = throwConnects(s, 0), t1 = throwConnects(s, 1);
  if (t0 && t1) { techThrow(f0, f1); event(s, "throw", 0, f1, 0); return; }
  if (t0 || t1) { const i = t0 ? 0 : 1; grabStart(s.fighters[i], s.fighters[1 - i]!); return; }
  const p0 = detect(s, 0), p1 = detect(s, 1);
  if (p0) apply(s, 0, p0);
  if (p1) apply(s, 1, p1);
}

/** Spec §8 `pushback(s)`: apply pending pushback; the part a wall stops goes to the opponent (CORNER_PUSH_TRANSFER). */
export function pushback(s: MatchState): void {
  for (let i = 0; i < 2; i++) {
    const f = s.fighters[i]!, o = s.fighters[1 - i]!;
    if (f.pushRemain === 0 || f.hitstop > 0) continue;
    let d = f.pushPerFrame;
    if (d === 0 || (d > 0 ? d > f.pushRemain : d < f.pushRemain)) d = f.pushRemain;
    f.pushRemain -= d;
    if (f.pushRemain === 0) f.pushPerFrame = 0;
    const nx = clamp(f.x + d, WALL_MIN, WALL_MAX);
    const leftover = f.x + d - nx;
    f.x = nx;
    if (leftover !== 0 && CORNER_PUSH_TRANSFER) o.x = clamp(o.x - leftover, WALL_MIN, WALL_MAX);
  }
}
