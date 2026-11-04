// Projectiles (spec §8.4). Integers only; array order is the iteration order.
import { getMove } from "../chars/index.js";
import type { CharId, MoveDef, ProjectileDef } from "../chars/types.js";
import { PX, idiv } from "../fixed.js";
import { JUGGLE_FALL_VX, JUGGLE_FALL_VY, METER_DEFENDER_PERCENT, STAGE_LEFT, STAGE_RIGHT } from "./constants.js";
import { addMeter, curMove } from "./fighter.js";
import {
  PARRY_HITSTOP, blocksFrom, event, hurtboxes, moveInvuln, overlaps, parryWindow,
  scaledDamage, setPushbackDir, toJuggle, type WorldBox,
} from "./hit.js";
import type { MatchState, Projectile } from "./types.js";

export const EXPLOSION_FRAMES = 20;
export const EXPLOSION_W = 80;
export const EXPLOSION_H = 60;
/** Removed when more than 100 px past a stage edge. */
const OFFSTAGE = 100 * PX;

export function projectileDef(p: Projectile): ProjectileDef | null {
  const c = p.def.indexOf(":");
  const m = getMove(p.def.slice(0, c) as CharId, p.def.slice(c + 1));
  return m?.projectile ?? null;
}

export function ownedBy(s: MatchState, i: number): number {
  let n = 0;
  for (const p of s.projectiles) if (p.owner === i) n++;
  return n;
}

/** Spawn move m's projectile for fighter i at `offset` (px, forward/up from the owner's origin). */
export function spawnProjectile(s: MatchState, i: 0 | 1, m: MoveDef, offset: { x: number; y: number }): void {
  const f = s.fighters[i];
  const d = m.projectile!;
  s.projectiles.push({
    owner: i, kind: d.kind,
    x: f.x + offset.x * PX * f.facing, y: f.y + offset.y * PX,
    vx: d.vx * f.facing, vy: d.vy, gravity: d.gravity,
    w: d.w, h: d.h, hits: d.hits, hitInterval: d.hitInterval, cooldown: 0, life: d.lifetime,
    def: `${f.char}:${m.id}`, exploding: 0,
  });
}

/** World box: w/h centred on (x, y). */
export function projBox(p: Projectile): WorldBox {
  const hw = (p.w * PX) >> 1, hh = (p.h * PX) >> 1;
  return { left: p.x - hw, right: p.x - hw + p.w * PX, bottom: p.y - hh, top: p.y - hh + p.h * PX };
}

/** Spec §8 `projectiles(s)`: move, lifetime, ground explosion, clash, fighter contact, removal. */
export function projectiles(s: MatchState): void {
  const ps = s.projectiles;
  for (const p of ps) {
    if (p.cooldown > 0) p.cooldown--;
    if (p.exploding > 0) { p.exploding--; if (p.exploding === 0) p.life = 0; continue; }
    p.vy -= p.gravity; p.x += p.vx; p.y += p.vy; p.life--;
    if (projectileDef(p)?.explodeOnGround && p.y <= 0) {
      p.y = 0; p.vx = 0; p.vy = 0; p.exploding = EXPLOSION_FRAMES; p.w = EXPLOSION_W; p.h = EXPLOSION_H;
      if (p.life <= 0) p.life = 1; // the explosion outlives the egg's own lifetime
    }
  }
  // Clash: different owners overlapping → each loses a hit.
  for (let a = 0; a < ps.length; a++) {
    for (let b = a + 1; b < ps.length; b++) {
      const p = ps[a]!, q = ps[b]!;
      if (p.owner === q.owner || p.hits <= 0 || q.hits <= 0 || !overlaps(projBox(p), projBox(q))) continue;
      p.hits--; q.hits--;
      s.events.push({ frame: s.frame, kind: "projectileClash", x: (p.x + q.x) >> 1, y: (p.y + q.y) >> 1, strength: 1, by: p.owner });
    }
  }
  for (const p of ps) if (p.hits > 0 && p.cooldown === 0) contact(s, p);
  s.projectiles = ps.filter((p) => p.life > 0 && p.hits > 0 && p.x > STAGE_LEFT - OFFSTAGE && p.x < STAGE_RIGHT + OFFSTAGE);
}

const IMMUNE_STATES = ["knockdown", "getup", "ko", "thrown", "throwing", "techSep"];

/** Projectile vs the opponent of its owner (spec §8.4 + §8.3 rules). */
function contact(s: MatchState, p: Projectile): void {
  const def = projectileDef(p);
  if (!def) return;
  const o = s.fighters[p.owner], d = s.fighters[1 - p.owner]!;
  if (IMMUNE_STATES.includes(d.state) || moveInvuln(d, ["full", "projectile"])) return;
  const last = p.hits === 1;
  const kd = last && def.knockdown;
  if (d.state === "juggle" && !kd) return; // juggle limit: only a knockdown (launch-like) hit connects
  if (!hurtboxes(d).some((h) => overlaps(projBox(p), h))) return;
  p.hits--; p.cooldown = p.hitInterval;
  // Direction the projectile pushes: its travel direction, else away from its owner.
  const dir = p.vx > 0 ? 1 : p.vx < 0 ? -1 : d.x >= o.x ? 1 : -1;
  if (parryWindow(d, "mid")) {
    p.hits = 0; // destroyed, no damage to the owner
    d.hitstop = PARRY_HITSTOP; d.cancelOk = false;
    event(s, "parry", (1 - p.owner) as 0 | 1, d, 2);
    return;
  }
  const dm = d.state === "attack" ? curMove(d) : null;
  const blocked = blocksFrom(d, p.x - dir, def.level);
  d.hitstop = d.hitstop > def.hitstop ? d.hitstop : def.hitstop; // projectile hitstop freezes only the defender
  const strength: 0 | 1 = def.hitstop >= 11 ? 1 : 0;
  d.move = null; d.moveFrame = 0; d.cancelOk = false; d.counterArmed = false; d.vx = 0; d.lockLeft = 0;
  if (blocked) {
    let hp = d.hp - def.chip;
    if (hp < 1) hp = d.hp < 1 ? d.hp : 1; // CHIP_KO_ALLOWED = false
    d.hp = hp;
    d.state = "blockstun"; d.stateFrame = 1; d.stun = def.blockstun;
    setPushbackDir(d, dir, def.pushback);
    addMeter(o, idiv(def.meterOnHit, 2));
    event(s, "block", p.owner, d, strength);
    return;
  }
  const counter = !!dm && d.moveFrame <= dm.startup;
  let dmg = scaledDamage(def.damage, d.comboHits);
  if (counter) dmg = idiv(dmg * 12, 10);
  d.hp -= dmg; if (d.hp < 0) d.hp = 0;
  d.comboHits++;
  addMeter(o, def.meterOnHit);
  addMeter(d, idiv(dmg * METER_DEFENDER_PERCENT, 100));
  if (d.airborne || kd) {
    toJuggle(d, JUGGLE_FALL_VX * dir, JUGGLE_FALL_VY);
  } else {
    d.state = "hitstun"; d.stateFrame = 1; d.stun = def.hitstun + (counter ? 2 : 0);
    setPushbackDir(d, dir, def.pushback);
  }
  event(s, counter ? "counter" : "hit", p.owner, d, counter ? 2 : strength);
}
