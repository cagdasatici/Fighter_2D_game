// Special-move behaviour (S6). Integers only.
// Data-driven: `projectile`, `heal`, `lockOnHit`, `counter`, `grab`.
// Per-move-id code is allowed ONLY for: smokeStep, stampedeRoll, overload, shurikenFan.H, tailSpin (docs/tasks.md S6).
import { CHARS } from "../chars/index.js";
import type { HitDef, MoveDef } from "../chars/types.js";
import { clamp } from "../fixed.js";
import { curMove } from "./fighter.js";
import { addLockHit, event, toJuggle, worldBox, type WorldBox } from "./hit.js";
import { WALL_MAX, WALL_MIN } from "./physics.js";
import { spawnProjectile } from "./projectile.js";
import type { Fighter, MatchState } from "./types.js";

/** Move frame on which `heal` is applied. TODO: MoveDef has no heal-frame field; only dragonDumpling heals (f10). */
export const HEAL_FRAME = 10;

// smokeStep (Kaze): teleport f10, face the opponent f15.
const SMOKE_TELEPORT_FRAME = 10;
const SMOKE_FACE_FRAME = 15;
const SMOKE_BEHIND = 6000;   // LK: 60 px behind the opponent
const SMOKE_FRONT = 12000;   // HK: 120 px in front of the opponent
// overload (Volt): column spawn frames and x offsets (px).
const OVERLOAD_FRAMES = [10, 18, 26, 34, 42];
const OVERLOAD_X = [80, 180, 280, 380, 480];
// shurikenFan.H (Kaze): second star 4 frames after the first, offset (40,60).
const FAN_SECOND_DELAY = 4;
const FAN_SECOND_OFFSET = { x: 40, y: 60 };
// stampedeRoll (Chompa): a contact every 6 frames, at most 6; rebounds once off a wall.
const STAMPEDE_INTERVAL = 6;
const STAMPEDE_MAX_HITS = 6;

const isId = (m: MoveDef, base: string): boolean => m.id === base || m.id.startsWith(base + ".");

/** Jump a move to the first recovery frame (moveFrame is advanced before use, so set to the last active frame). */
function endActive(f: Fighter, m: MoveDef): void {
  f.moveFrame = m.startup + m.active;
}

/**
 * Per-frame move behaviour after physics, for fighter i (only when it was not in hitstop this frame).
 * Projectile spawns, heal, overload columns, smokeStep teleport, stampedeRoll rebound/re-hit timer.
 */
export function moveTick(s: MatchState, i: 0 | 1): void {
  const f = s.fighters[i], opp = s.fighters[1 - i]!;
  if (f.rehit > 0) f.rehit--;
  if (f.state !== "attack") return;
  const m = curMove(f);
  if (!m) return;
  const mf = f.moveFrame;
  if (m.heal > 0 && mf === HEAL_FRAME) {
    const max = CHARS[f.char].hp;
    f.hp = f.hp + m.heal > max ? max : f.hp + m.heal;
  }
  if (m.projectile) {
    if (m.id === "overload") {
      const k = OVERLOAD_FRAMES.indexOf(mf);
      if (k >= 0) spawnProjectile(s, i, m, { x: OVERLOAD_X[k]!, y: m.projectile.offset.y });
    } else {
      if (mf === m.projectile.spawnFrame) spawnProjectile(s, i, m, m.projectile.offset);
      if (m.id === "shurikenFan.H" && mf === m.projectile.spawnFrame + FAN_SECOND_DELAY) spawnProjectile(s, i, m, FAN_SECOND_OFFSET);
    }
  }
  if (isId(m, "smokeStep")) {
    if (mf === SMOKE_TELEPORT_FRAME) {
      const off = m.id.endsWith(".L") ? -SMOKE_BEHIND : SMOKE_FRONT;
      f.x = clamp(opp.x + off * opp.facing, WALL_MIN, WALL_MAX);
    }
    if (mf === SMOKE_FACE_FRAME && opp.x !== f.x) f.facing = opp.x > f.x ? 1 : -1;
  }
  if (m.id === "stampedeRoll") {
    // Rebound once: reverse vx at wall contact, facing unchanged. spCount += 256 marks "rebounded"; low byte = contacts.
    const atWall = (f.x <= WALL_MIN && f.vx < 0) || (f.x >= WALL_MAX && f.vx > 0);
    if (atWall && f.spCount < 256) { f.x = clamp(f.x, WALL_MIN, WALL_MAX); f.vx = -f.vx; f.spCount += 256; }
  }
}

/** Reset per-move special bookkeeping when a move starts. */
export function resetSpecial(f: Fighter): void {
  f.lockLeft = 0; f.lockTimer = 0; f.rehit = 0; f.spCount = 0;
}

/** Hit k of move m may connect this frame (rule 1 + stampedeRoll re-hit). */
export function strikeReady(a: Fighter, m: MoveDef, k: number): boolean {
  if (a.lockLeft > 0) return false;
  if (m.id === "stampedeRoll") return a.rehit === 0 && (a.spCount & 255) < STAMPEDE_MAX_HITS;
  return (a.moveHitMask & (1 << k)) === 0;
}

/** World hitboxes for hit h (tailSpin hits both sides: box plus its mirror). */
export function strikeBoxes(a: Fighter, m: MoveDef, h: HitDef): WorldBox[] {
  const out = [worldBox(a, h.box)];
  if (isId(m, "tailSpin")) out.push(worldBox(a, { ...h.box, x: -(h.box.x + h.box.w) }));
  return out;
}

/** HitDef actually applied (stampedeRoll launches only on its last contact). */
export function strikeHit(a: Fighter, m: MoveDef, h: HitDef): HitDef {
  if (m.id === "stampedeRoll" && (a.spCount & 255) + 1 < STAMPEDE_MAX_HITS) return { ...h, launch: null };
  return h;
}

/** After a strike contact (hit or block) by attacker a with move m. */
export function onStrike(a: Fighter, d: Fighter, m: MoveDef, blocked: boolean): void {
  if (m.id === "stampedeRoll") {
    a.spCount++;
    a.rehit = STAMPEDE_INTERVAL;
    if ((a.spCount & 255) >= STAMPEDE_MAX_HITS) { a.vx = 0; endActive(a, m); }
  }
  if (m.lockOnHit) {
    a.vx = 0;
    if (blocked) { endActive(a, m); return; }
    // The first contact is hit 1 of lockOnHit.hits; then hits-1 more, then the final hit.
    a.lockLeft = m.lockOnHit.hits; a.lockTimer = m.lockOnHit.interval;
    d.vx = 0; d.pushRemain = 0; d.pushPerFrame = 0;
  }
}

/** Advance lockOnHit sequences (called at the start of hits()). Positions stay locked; follow-ups are unscaled. */
export function lockTick(s: MatchState): void {
  for (const i of [0, 1] as const) {
    const a = s.fighters[i], d = s.fighters[1 - i]!;
    if (a.lockLeft === 0) continue;
    const m = a.state === "attack" ? curMove(a) : null;
    if (!m?.lockOnHit || d.state === "ko") { a.lockLeft = 0; continue; } // a KO ends the lock (spec §10)
    if (a.hitstop > 0) continue;
    a.vx = 0; d.vx = 0; d.pushRemain = 0; d.pushPerFrame = 0;
    if (--a.lockTimer > 0) continue;
    const L = m.lockOnHit;
    if (a.lockLeft > 1) {
      addLockHit(a, d, L.damage);
      d.state = "hitstun"; d.stateFrame = 1; d.stun = L.interval + 1;
      a.lockLeft--; a.lockTimer = L.interval;
      event(s, "hit", i, d, 1);
    } else {
      addLockHit(a, d, L.finalDamage);
      toJuggle(d, L.finalLaunch.vx * a.facing, L.finalLaunch.vy);
      a.lockLeft = 0; endActive(a, m);
      event(s, "hit", i, d, 2);
    }
  }
}
