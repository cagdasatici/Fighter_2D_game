import { CHARS, getMove } from "../chars/index.js";
import type { MoveDef } from "../chars/types.js";
import { idiv } from "../fixed.js";
import { HK, HP, LK, LP, UP, numpad, type InputByte } from "../input/buttons.js";
import { inputAt, pressed } from "../input/history.js";
import { chargeReady, detectMotion, MOTION_WINDOW, resolveRequest, type MotionId } from "../input/motion.js";
import {
  AIR_JUMP_MIN_VY, AIR_JUMP_VX_PERCENT, AIR_JUMP_VY, DASH_WINDOW, GETUP_FRAMES, JUMP_SQUAT,
  KNOCKDOWN_FRAMES, LANDING_RECOVERY, LANDING_RECOVERY_ATTACK, METER_MAX, METER_ON_WHIFF_SPECIAL,
  THROW_TECH_WINDOW,
} from "./constants.js";
import { PROJECTILE_LIMIT_PER_PLAYER } from "./constants.js";
import { resetSpecial } from "./specials.js";
import type { Fighter, FState } from "./types.js";

/** Frames a fighter stays in `thrown`/`throwing` before the throw resolves (spec §8.3). */
export const THROW_HOLD_FRAMES = 30;
/** `techSep` duration and total separation (spec §8.3). */
export const TECH_SEP_FRAMES = 16;
export const TECH_SEP_DISTANCE = 6000;
/** Button-press buffer for specials: current frame + previous 3 (spec §5.3). */
export const BUTTON_BUFFER = 4;

export function setState(f: Fighter, s: FState): void {
  if (f.state !== s) { f.state = s; f.stateFrame = 1; }
}

export function curMove(f: Fighter): MoveDef | null {
  return f.move === null ? null : getMove(f.char, f.move) ?? null;
}
export const totalFrames = (m: MoveDef): number => m.startup + m.active + m.recovery;
export function addMeter(f: Fighter, n: number): void {
  f.meter += n;
  if (f.meter > METER_MAX) f.meter = METER_MAX;
}

/** Step A (spec §8): face the opponent in idle/walk/crouch/land and on the frame jumpSquat ends. */
export function updateFacing(f: Fighter, opp: Fighter): void {
  const st = f.state;
  const ok = st === "idle" || st === "walkF" || st === "walkB" || st === "crouch" || st === "land"
    || (st === "jumpSquat" && f.stateFrame + 1 > JUMP_SQUAT);
  if (!ok || opp.x === f.x) return;
  f.facing = opp.x > f.x ? 1 : -1;
}

/** Horizontal part of a numpad direction: -1 back, 0, +1 forward. */
function horiz(dir: number): number { return dir % 3 === 0 ? 1 : dir % 3 === 1 ? -1 : 0; }

/** 6,5,6 (or 4,5,4): `want` now and not last frame, a 5 before that, and `want` before the 5, within DASH_WINDOW. */
function dashInput(f: Fighter, want: 4 | 6): boolean {
  if (numpad(inputAt(f, 0), f.facing) !== want || numpad(inputAt(f, 1), f.facing) === want) return false;
  let seenNeutral = false;
  for (let ago = 1; ago <= DASH_WINDOW; ago++) {
    const d = numpad(inputAt(f, ago), f.facing);
    if (!seenNeutral) { if (d === 5) seenNeutral = true; else return false; }
    else if (d === want) return true;
    else if (d !== 5) return false;
  }
  return false;
}

// ---- move requests (spec §5.3 priority, §8.1 step 1) ----

const BUTTON_MASK: Readonly<Record<MoveDef["input"]["button"], number>> = {
  LP, HP, LK, HK, P: LP | HP, K: LK | HK, "LP+LK": LP | LK,
};
/** Normal-button priority when several are pressed on one frame (spec is silent): heaviest first. */
const NORMAL_ORDER = [HK, HP, LK, LP] as const;
const SINGLE: Readonly<Record<number, MoveDef["input"]["button"]>> = { [LP]: "LP", [HP]: "HP", [LK]: "LK", [HK]: "HK" };

/** Any single button of `mask` pressed within the last `frames` frames (ago 0..frames-1). */
function pressedWithin(f: Fighter, mask: number, frames: number): boolean {
  for (let ago = 0; ago < frames; ago++) {
    for (const b of NORMAL_ORDER) if ((mask & b) !== 0 && pressed(f, b, ago)) return true;
  }
  return false;
}

/** Throw input: LP and LK each pressed within 2 frames of each other, one of them this frame. */
export function throwInput(f: Fighter): boolean {
  if (!pressed(f, LP, 0) && !pressed(f, LK, 0)) return false;
  let lp = false, lk = false;
  for (let ago = 0; ago <= 2; ago++) { lp ||= pressed(f, LP, ago); lk ||= pressed(f, LK, ago); }
  return lp && lk;
}

type MoveFilter = (m: MoveDef) => boolean;

function motionOrder(f: Fighter): ("charge" | MotionId)[] {
  const qc: MotionId[] = resolveRequest(f, f.facing) === "qcb" ? ["qcb", "qcf"] : ["qcf", "qcb"];
  return ["dqcf", "spin", "dp", ...qc, "charge", "dd"];
}
function motionHeld(f: Fighter, m: "charge" | MotionId): boolean {
  if (m === "charge") { const np = numpad(inputAt(f, 0), f.facing); return chargeReady(f) && (np === 6 || np === 3 || np === 9); }
  return detectMotion(f, f.facing, m, MOTION_WINDOW[m]);
}

/** First move the current inputs request, in §5.3 priority, restricted by `allow`. */
export function requestMove(f: Fighter, allow: MoveFilter, ownProjectiles = 0): MoveDef | null {
  const moves = CHARS[f.char].moves;
  const dir = numpad(inputAt(f, 0), f.facing);
  // 1. Specials (buffered button). TODO(S7): supers (meter cost + freeze) are not started yet.
  // Projectile limit (spec §8.1): a projectile special is refused while the fighter owns PROJECTILE_LIMIT_PER_PLAYER.
  if (f.buffered > 0) {
    for (const mo of motionOrder(f)) {
      if (!motionHeld(f, mo)) continue;
      for (const m of moves) {
        if (m.kind !== "special" || m.input.motion !== mo) continue;
        if ((m.input.stance === "air") !== f.airborne) continue;
        if (!pressedWithin(f, BUTTON_MASK[m.input.button], BUTTON_BUFFER) || !allow(m)) continue;
        if (m.projectile && ownProjectiles >= PROJECTILE_LIMIT_PER_PLAYER) continue;
        return m;
      }
    }
  }
  if (!f.airborne) {
    // 2. Throw.
    if (throwInput(f)) {
      const t = moves.find((m) => m.kind === "throw");
      if (t && allow(t)) return t;
    }
    // 3. Command normal (direction + button this frame).
    for (const m of moves) {
      if (m.kind === "command" && m.input.dir === dir && pressedWithin(f, BUTTON_MASK[m.input.button], 1) && allow(m)) return m;
    }
  }
  // 4. Normal by stance.
  const stance = f.airborne ? "air" : dir <= 3 ? "crouch" : "stand";
  for (const b of NORMAL_ORDER) {
    if (!pressed(f, b, 0)) continue;
    const m = moves.find((x) => x.kind === "normal" && x.input.stance === stance && x.input.button === SINGLE[b]);
    if (m && allow(m)) return m;
  }
  return null;
}

function applyVelocities(f: Fighter, m: MoveDef): void {
  for (const v of m.velocities) {
    if (v.frame !== f.moveFrame) continue;
    f.vx = v.vx * f.facing;
    if (v.vy !== null) { f.vy = v.vy; if (v.vy > 0) f.airborne = true; }
  }
}

export function startMove(f: Fighter, m: MoveDef): void {
  f.state = "attack"; f.stateFrame = 1;
  f.move = m.id; f.moveFrame = 1; f.moveHitMask = 0; f.cancelOk = false;
  f.buffered = 0; f.stun = 0;
  if (!f.airborne) { f.vx = 0; f.crouching = m.input.stance === "crouch"; }
  f.counterArmed = m.counter !== null;
  f.gravityScale = m.gravityScale;
  resetSpecial(f);
  // Spec §8.1: specials grant METER_ON_WHIFF_SPECIAL at frame 1.
  if (m.kind === "special") addMeter(f, METER_ON_WHIFF_SPECIAL);
  applyVelocities(f, m);
}

function enterIdle(f: Fighter): void {
  f.move = null; f.moveFrame = 0; f.moveHitMask = 0; f.cancelOk = false; f.counterArmed = false;
  f.stun = 0; f.comboHits = 0; // spec §8.3 rule 7
}

function actionable(f: Fighter, input: InputByte, np: number): void {
  enterIdle(f);
  const req = requestMove(f, () => true, np);
  if (req) { startMove(f, req); return; }
  const c = CHARS[f.char];
  const dir = numpad(input, f.facing);
  f.crouching = false;
  if (dir >= 7) { setState(f, "jumpSquat"); f.vx = 0; return; }
  if (dashInput(f, 6)) { setState(f, "dashF"); f.vx = c.dashFwd.speed * f.facing; return; }
  if (dashInput(f, 4)) {
    setState(f, "dashB"); f.vx = -c.dashBack.speed * f.facing;
    f.invuln = "strike"; f.invulnFrames = c.dashBack.invuln; return;
  }
  if (dir <= 3) { setState(f, "crouch"); f.crouching = true; f.vx = 0; return; }
  if (dir === 6) { setState(f, "walkF"); f.vx = c.walkFwd * f.facing; return; }
  if (dir === 4) { setState(f, "walkB"); f.vx = -c.walkBack * f.facing; return; }
  setState(f, "idle"); f.vx = 0;
}

/** Cancel filter (spec §8.1): specials if the move lists "special", chain = same-button normal. */
function cancelFilter(cur: MoveDef): MoveFilter {
  return (m) => (m.kind === "special" && cur.cancelInto.includes("special"))
    || (m.kind === "normal" && cur.cancelInto.includes("chain") && m.input.button === cur.input.button);
}

/** Both fighters enter techSep and slide apart (spec §8.3). */
export function techThrow(a: Fighter, b: Fighter): void {
  const side = b.x > a.x ? 1 : b.x < a.x ? -1 : a.facing;
  for (const [f, dir] of [[a, -side], [b, side]] as const) {
    enterIdle(f); setState(f, "techSep"); f.vx = 0;
    f.pushRemain = dir * idiv(TECH_SEP_DISTANCE, 2);
    f.pushPerFrame = pushStep(f.pushRemain);
  }
}

/** Per-frame share of a signed pushback, rounded away from zero so it finishes in PUSHBACK_FRAMES. */
export function pushStep(total: number): number {
  return total === 0 ? 0 : idiv(total + (total > 0 ? 7 : -7), 8);
}

/** Step B (spec §8.1). */
/** `np` = projectiles this fighter currently owns (projectile limit). */
export function stateMachine(f: Fighter, opp: Fighter, input: InputByte, np = 0): void {
  const c = CHARS[f.char];
  f.stateFrame++;
  f.gravityScale = 100;
  if (f.invulnFrames > 0) { f.invulnFrames--; if (f.invulnFrames === 0) f.invuln = "none"; }
  switch (f.state) {
    case "jumpSquat": {
      // Spec §5.3: a 360 grab may be input during jumpSquat frames 1-2 and cancels the jump.
      if (f.stateFrame <= 2) {
        const g = requestMove(f, (m) => m.input.motion === "spin", np);
        if (g) { startMove(f, g); return; }
      }
      if (f.stateFrame <= JUMP_SQUAT) return;
      // Direction comes from the frame the jump was input (JUMP_SQUAT frames ago).
      const h = horiz(numpad(inputAt(f, JUMP_SQUAT), f.facing));
      setState(f, "air");
      f.airborne = true; f.vy = c.jumpVy; f.vx = h * c.jumpVx * f.facing;
      return;
    }
    case "air": {
      // `move` stays set after an air normal ends: one air attack per jump (spec §8.1).
      if (f.move === null) {
        const req = requestMove(f, (m) => m.kind === "normal" || (m.kind === "special" && m.input.stance === "air"), np);
        if (req) { startMove(f, req); return; }
      }
      const up = (inputAt(f, 0) & UP) !== 0 && (inputAt(f, 1) & UP) === 0;
      if (up && f.airJumps < c.airJumpMax && f.vy < AIR_JUMP_MIN_VY) {
        const h = horiz(numpad(input, f.facing));
        f.airJumps++;
        f.vy = AIR_JUMP_VY;
        f.vx = h * idiv(c.jumpVx * AIR_JUMP_VX_PERCENT, 100) * f.facing;
      }
      return;
    }
    case "attack": {
      const m = curMove(f);
      if (!m) { actionable(f, input, np); return; }
      if (f.lockLeft > 0) return; // lockOnHit: move frozen while the lock sequence runs (sim/specials.ts)
      f.moveFrame++;
      f.gravityScale = m.gravityScale;
      if (f.moveFrame > totalFrames(m)) {
        if (f.airborne) { setState(f, "air"); return; } // keeps `move` as the one-per-jump marker
        actionable(f, input, np); return;
      }
      applyVelocities(f, m);
      // Throw = LP+LK within 2 frames: a grounded light normal started ≤2 frames ago upgrades to the throw.
      if (!f.airborne && f.moveFrame <= 3 && m.kind === "normal" && (m.input.button === "LP" || m.input.button === "LK") && throwInput(f)) {
        const t = CHARS[f.char].moves.find((x) => x.kind === "throw");
        if (t) { startMove(f, t); return; }
      }
      if (f.cancelOk) {
        const req = requestMove(f, cancelFilter(m), np);
        if (req) startMove(f, req);
      }
      return;
    }
    case "hitstun": case "blockstun":
      if (f.stun > 0) { f.stun--; return; }
      actionable(f, input, np); return;
    case "knockdown":
      if (f.stun > 0) { f.stun--; return; }
      setState(f, "getup"); f.stun = GETUP_FRAMES; f.invuln = "full"; f.invulnFrames = GETUP_FRAMES;
      return;
    case "getup":
      if (f.stun > 0) { f.stun--; return; }
      actionable(f, input, np); return;
    case "thrown":
      // Tech: LP+LK within THROW_TECH_WINDOW frames after the grab frame; command grabs cannot be teched.
      if (f.stateFrame - 1 <= THROW_TECH_WINDOW && opp.state === "throwing" && curMove(opp)?.kind === "throw" && throwInput(f)) {
        techThrow(opp, f);
      }
      return;
    case "throwing":
      if (opp.state !== "thrown") actionable(f, input, np);
      return;
    case "techSep":
      if (f.stateFrame <= TECH_SEP_FRAMES) return;
      actionable(f, input, np); return;
    case "juggle":
      return; // ends on landing (afterPhysics)
    case "land": {
      const dur = f.stun > 0 ? f.stun : LANDING_RECOVERY;
      if (f.stateFrame <= dur) return;
      actionable(f, input, np); return;
    }
    case "dashF":
      if (f.stateFrame <= c.dashFwd.frames) return;
      actionable(f, input, np); return;
    case "dashB":
      if (f.stateFrame <= c.dashBack.frames) return;
      actionable(f, input, np); return;
    case "idle": case "walkF": case "walkB": case "crouch":
      actionable(f, input, np); return;
    default:
      return; // ko / win: S7
  }
}

/** After physics (spec §8.2 landing rules not covered by physics()): juggle → knockdown, air attack → land. */
export function afterPhysics(f: Fighter, wasAirborne: boolean): void {
  if (!wasAirborne || f.airborne) return;
  if (f.state === "juggle") {
    enterIdle(f); setState(f, "knockdown"); f.vx = 0;
    f.stun = KNOCKDOWN_FRAMES; f.invuln = "full"; f.invulnFrames = KNOCKDOWN_FRAMES + 1;
    return;
  }
  if (f.state === "attack" || (f.state === "land" && f.move !== null)) {
    const m = curMove(f);
    const lr = m && m.landingRecovery > 0 ? m.landingRecovery : LANDING_RECOVERY_ATTACK;
    enterIdle(f); f.state = "land"; f.stateFrame = 1; f.vx = 0; f.stun = lr;
  }
}
