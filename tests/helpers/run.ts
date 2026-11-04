import { ROUND_INTRO_FRAMES } from "../../packages/shared/src/sim/constants.js";
import { step } from "../../packages/shared/src/sim/step.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";

export type Frame = [number, number];

/** Step once per input pair. Returns the state for chaining. */
export function runFrames(s: MatchState, frames: Frame[]): MatchState {
  for (const f of frames) step(s, f);
  return s;
}

/** `n` frames holding the same bytes. */
export function hold(b0: number, b1: number, n: number): Frame[] {
  return Array.from({ length: n }, (): Frame => [b0, b1]);
}

export function skipIntro(s: MatchState): MatchState {
  return runFrames(s, hold(0, 0, ROUND_INTRO_FRAMES));
}
