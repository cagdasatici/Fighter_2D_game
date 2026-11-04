import { cleanSocd, type InputByte } from "../input/buttons.js";
import { pushInput } from "../input/history.js";
import { ROUND_INTRO_FRAMES } from "./constants.js";
import { stateMachine, updateFacing } from "./fighter.js";
import { physics, pushboxes } from "./physics.js";
import type { MatchState } from "./types.js";

/** Advance one frame (spec §8). The only function that mutates sim state over time. */
export function step(s: MatchState, inputs: [InputByte, InputByte]): void {
  s.events = [];
  s.frame++;
  const [a, b] = s.fighters;
  pushInput(a, cleanSocd(inputs[0]));
  pushInput(b, cleanSocd(inputs[1]));
  if (s.superFreeze > 0) { s.superFreeze--; return; }
  const live = s.phase === "fight";
  const prevX: [number, number] = [a.x, b.x];
  const wasAir: [boolean, boolean] = [a.airborne, b.airborne];
  for (let i = 0; i < 2; i++) {
    const f = s.fighters[i]!, opp = s.fighters[1 - i]!;
    if (f.hitstop > 0) { f.hitstop--; continue; }
    updateFacing(f, opp);
    stateMachine(f, opp, live ? cleanSocd(inputs[i]!) : 0);
    physics(f);
  }
  pushboxes(s, prevX, [wasAir[0] && !a.airborne, wasAir[1] && !b.airborne]);
  projectiles(s);
  hits(s);
  pushback(s);
  round(s);
}

// TODO(S5): hit detection, pushback. TODO(S6): projectiles. TODO(S7): timer, KO, round flow.
function projectiles(_s: MatchState): void { /* S6 */ }
function hits(_s: MatchState): void { /* S5 */ }
function pushback(_s: MatchState): void { /* S5 */ }
function round(s: MatchState): void {
  if (s.phase === "intro") {
    s.phaseFrame++;
    if (s.phaseFrame >= ROUND_INTRO_FRAMES) { s.phase = "fight"; s.phaseFrame = 0; }
  }
}
