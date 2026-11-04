// Round and match flow (spec §10). Integers only.
import { CHARS } from "../chars/index.js";
import { idiv } from "../fixed.js";
import {
  JUGGLE_FALL_VX, JUGGLE_FALL_VY, ROUND_END_FRAMES, ROUND_FRAMES, ROUND_INTRO_FRAMES, ROUNDS_TO_WIN, START_X,
} from "./constants.js";
import { event } from "./hit.js";
import { createFighter } from "./state.js";
import type { Fighter, MatchState } from "./types.js";

/** After this many draw rounds the next round is final (spec §10). */
export const MAX_DRAW_ROUNDS = 3;

/** Remaining hp in per-mille of max hp (spec §10 time over: `hp*1000/char.hp`). */
export function hpPermille(f: Fighter): number {
  return idiv(f.hp * 1000, CHARS[f.char].hp);
}

/** Round winner, or null for a draw. Call once the round is decided (KO or time over). */
export function roundWinner(s: MatchState): 0 | 1 | null {
  const [a, b] = s.fighters;
  const ka = a.hp <= 0, kb = b.hp <= 0;
  if (ka || kb) return ka && kb ? null : ka ? 1 : 0;
  const pa = hpPermille(a), pb = hpPermille(b);
  return pa === pb ? null : pa > pb ? 0 : 1;
}

function knockOut(s: MatchState, i: 0 | 1): void {
  const f = s.fighters[i], o = s.fighters[1 - i]!;
  const wasGrounded = !f.airborne;
  f.state = "ko"; f.stateFrame = 1; f.move = null; f.moveFrame = 0; f.cancelOk = false; f.counterArmed = false;
  f.stun = 0; f.lockLeft = 0; f.pushRemain = 0; f.pushPerFrame = 0; f.crouching = false;
  if (wasGrounded) {
    // "juggle trajectory if was standing": fall away from the opponent.
    const away = f.x > o.x ? 1 : f.x < o.x ? -1 : -f.facing;
    f.airborne = true; f.vx = JUGGLE_FALL_VX * away; f.vy = JUGGLE_FALL_VY;
  }
  event(s, "ko", (1 - i) as 0 | 1, f, 2);
}

/** Positions reset, hp full, meter and wins kept, projectiles cleared (spec §10 intro). */
function resetRound(s: MatchState): void {
  const [a, b] = s.fighters;
  const na = createFighter(a.char, -START_X, 1), nb = createFighter(b.char, START_X, -1);
  na.meter = a.meter; na.wins = a.wins; nb.meter = b.meter; nb.wins = b.wins;
  s.fighters = [na, nb];
  s.projectiles = [];
  s.timer = ROUND_FRAMES; s.superFreeze = 0; s.superBy = null;
  s.phase = "intro"; s.phaseFrame = 0;
}

/** Winner pose once the round winner is back on the ground and free (spec §10). */
function winPose(f: Fighter): void {
  if (f.airborne || f.state === "win" || f.hitstop > 0) return;
  if (f.state === "idle" || f.state === "walkF" || f.state === "walkB" || f.state === "crouch") {
    f.state = "win"; f.stateFrame = 1; f.vx = 0; f.crouching = false; f.move = null; f.moveFrame = 0;
  }
}

function endRound(s: MatchState): void {
  const w = roundWinner(s);
  const final = s.drawRounds >= MAX_DRAW_ROUNDS;
  if (w === null) {
    if (!final) { s.drawRounds++; s.round++; resetRound(s); return; }
    // Final round drawn: higher remaining hp wins; equal → P1 (spec §10 documented edge).
    const [a, b] = s.fighters;
    s.winner = b.hp > a.hp ? 1 : 0;
    s.phase = "matchEnd"; s.phaseFrame = 0;
    return;
  }
  s.fighters[w].wins++;
  if (final || s.fighters[w].wins >= ROUNDS_TO_WIN) {
    s.winner = w; s.phase = "matchEnd"; s.phaseFrame = 0;
    return;
  }
  s.round++;
  resetRound(s);
}

/** Spec §8 "timers & round" (end of step). Not called during superFreeze (step returns early). */
export function round(s: MatchState): void {
  const [a, b] = s.fighters;
  switch (s.phase) {
    case "intro":
      s.phaseFrame++;
      if (s.phaseFrame >= ROUND_INTRO_FRAMES) { s.phase = "fight"; s.phaseFrame = 0; }
      return;
    case "fight": {
      const ka = a.hp <= 0, kb = b.hp <= 0;
      if (ka || kb) {
        if (ka) knockOut(s, 0);
        if (kb) knockOut(s, 1);
        s.phase = "roundEnd"; s.phaseFrame = 0;
        return;
      }
      if (!(a.hitstop > 0 && b.hitstop > 0)) s.timer--;
      if (s.timer <= 0) { s.timer = 0; s.phase = "roundEnd"; s.phaseFrame = 0; }
      return;
    }
    case "roundEnd": {
      s.phaseFrame++;
      const w = roundWinner(s);
      if (w !== null) winPose(s.fighters[w]);
      if (s.phaseFrame >= ROUND_END_FRAMES) endRound(s);
      return;
    }
    case "matchEnd":
      s.phaseFrame++;
      return;
  }
}
