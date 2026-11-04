import { HK, HP, LK, LP, cleanSocd, type InputByte } from "../input/buttons.js";
import { pressed, pushInput } from "../input/history.js";
import { updateCharge } from "../input/motion.js";
import { ROUND_INTRO_FRAMES } from "./constants.js";
import { BUTTON_BUFFER, afterPhysics, stateMachine, updateFacing } from "./fighter.js";
import { hits, pushback } from "./hit.js";
import { physics, pushboxes } from "./physics.js";
import { ownedBy, projectiles } from "./projectile.js";
import { moveTick } from "./specials.js";
import type { MatchState } from "./types.js";

/** Advance one frame (spec §8). The only function that mutates sim state over time. */
export function step(s: MatchState, inputs: [InputByte, InputByte]): void {
  s.events = [];
  s.frame++;
  const [a, b] = s.fighters;
  pushInput(a, cleanSocd(inputs[0]));
  pushInput(b, cleanSocd(inputs[1]));
  for (const f of s.fighters) {
    // Special button buffer (spec §5.3): a press arms it; it only drains while the fighter is not
    // frozen (hitstop/superFreeze), so a cancel input made during hitstop survives it.
    if (pressed(f, LP) || pressed(f, HP) || pressed(f, LK) || pressed(f, HK)) f.buffered = BUTTON_BUFFER;
    else if (f.buffered > 0 && f.hitstop === 0 && s.superFreeze === 0) f.buffered--;
    updateCharge(f, f.facing);
  }
  if (s.superFreeze > 0) { s.superFreeze--; return; }
  const live = s.phase === "fight";
  const prevX: [number, number] = [a.x, b.x];
  const wasAir: [boolean, boolean] = [a.airborne, b.airborne];
  for (let i = 0; i < 2; i++) {
    const f = s.fighters[i]!, opp = s.fighters[1 - i]!;
    if (f.hitstop > 0) { f.hitstop--; continue; }
    updateFacing(f, opp);
    stateMachine(f, opp, live ? cleanSocd(inputs[i]!) : 0, ownedBy(s, i));
    const wasAir = f.airborne;
    physics(f);
    afterPhysics(f, wasAir);
    moveTick(s, i as 0 | 1);
  }
  pushboxes(s, prevX, [wasAir[0] && !a.airborne, wasAir[1] && !b.airborne]);
  projectiles(s);
  hits(s);
  pushback(s);
  round(s);
}

// TODO(S7): timer, KO, round flow.
function round(s: MatchState): void {
  if (s.phase === "intro") {
    s.phaseFrame++;
    if (s.phaseFrame >= ROUND_INTRO_FRAMES) { s.phase = "fight"; s.phaseFrame = 0; }
  }
}
