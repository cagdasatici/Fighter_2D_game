import { CHARS } from "../chars/index.js";
import { PX, clamp, idiv } from "../fixed.js";
import {
  AIR_PUSH_DY, GRAVITY, MAX_FIGHTER_GAP, STAGE_LEFT, STAGE_RIGHT, WALL_MARGIN,
} from "./constants.js";
import { setState } from "./fighter.js";
import { PLATFORMS } from "./platforms.js";
import type { Fighter, MatchState, StageId } from "./types.js";

export const WALL_MIN = STAGE_LEFT + WALL_MARGIN;
export const WALL_MAX = STAGE_RIGHT - WALL_MARGIN;

/** Step C (spec §8.2): integrate one fighter and resolve landing on a platform (highest first) or the ground. */
export function physics(f: Fighter, stage: StageId): void {
  if (f.dropTimer > 0) f.dropTimer--;
  if (!f.airborne) { f.x += f.vx; return; }
  const prevY = f.y;
  f.vy -= idiv(GRAVITY * f.gravityScale, 100);
  f.x += f.vx; f.y += f.vy;
  if (f.vy >= 0) return;
  if (f.dropTimer === 0) {
    const ps = PLATFORMS[stage];
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i]!;
      if (prevY >= p.y && f.y <= p.y && f.x >= p.x0 && f.x <= p.x1) { land(f, p.y, i); return; }
    }
  }
  if (f.y <= 0) land(f, 0, -1);
}

function land(f: Fighter, y: number, platform: number): void {
  f.y = y; f.vy = 0; f.vx = 0; f.airborne = false; f.airJumps = 0; f.platform = platform;
  if (f.state === "air") setState(f, "land");
}

/** Standing on a platform but outside its span (walked or pushed off): fall, no jump consumed. */
export function edgeFall(f: Fighter, stage: StageId): void {
  if (f.airborne || f.platform < 0) return;
  const p = PLATFORMS[stage][f.platform];
  if (p && f.x >= p.x0 && f.x <= p.x1) return;
  f.airborne = true; f.vy = 0; f.platform = -1; f.crouching = false;
  // Neutral states become "air"; hitstun/blockstun/attack/etc. keep their state and simply fall.
  if (f.state === "idle" || f.state === "walkF" || f.state === "walkB" || f.state === "crouch" || f.state === "land"
    || f.state === "dashF" || f.state === "dashB" || f.state === "getup") setState(f, "air");
}

/**
 * Pushboxes, walls, camera gap (spec §8.2). `prevX` = x at the start of the step,
 * `landed[i]` = fighter i touched down this step (cross-up tie-break).
 */
export function pushboxes(s: MatchState, prevX: [number, number], landed: [boolean, boolean]): void {
  const [a, b] = s.fighters;
  // Clamp to walls first so "at the wall" is known before pushing, and again after.
  a.x = clamp(a.x, WALL_MIN, WALL_MAX);
  b.x = clamp(b.x, WALL_MIN, WALL_MAX);
  const dy = a.y - b.y;
  // Same-level grounded fighters have dy 0; fighters on different platforms/heights only push when close in y.
  const airOk = dy < AIR_PUSH_DY && dy > -AIR_PUSH_DY;
  const minGap = idiv((CHARS[a.char].pushWidth + CHARS[b.char].pushWidth) * PX, 2);
  const dx = b.x - a.x;
  const adx = dx < 0 ? -dx : dx;
  if (airOk && adx < minGap) {
    // side = +1 when b ends up right of a.
    let side: number;
    if (dx !== 0) side = dx > 0 ? 1 : -1;
    else if (landed[0] && !landed[1]) side = a.facing;      // a goes to -a.facing
    else side = -b.facing;                                   // b goes to -b.facing
    const overlap = minGap - adx;
    const aBlocked = side > 0 ? a.x <= WALL_MIN : a.x >= WALL_MAX;
    const bBlocked = side > 0 ? b.x >= WALL_MAX : b.x <= WALL_MIN;
    let moveA = idiv(overlap, 2), moveB = overlap - moveA;
    if (aBlocked && !bBlocked) { moveA = 0; moveB = overlap; }
    else if (bBlocked && !aBlocked) { moveA = overlap; moveB = 0; }
    a.x -= side * moveA; b.x += side * moveB;
  }
  a.x = clamp(a.x, WALL_MIN, WALL_MAX);
  b.x = clamp(b.x, WALL_MIN, WALL_MAX);
  const gap = b.x - a.x, agap = gap < 0 ? -gap : gap;
  if (agap > MAX_FIGHTER_GAP) {
    const excess = agap - MAX_FIGHTER_GAP, dir = gap > 0 ? 1 : -1; // pull a toward +dir, b toward -dir
    const aMoved = a.x !== prevX[0], bMoved = b.x !== prevX[1];
    let pa: number, pb: number;
    if (aMoved && !bMoved) { pa = excess; pb = 0; }
    else if (bMoved && !aMoved) { pa = 0; pb = excess; }
    else { pa = idiv(excess, 2); pb = excess - pa; }
    a.x += dir * pa; b.x -= dir * pb;
  }
}
