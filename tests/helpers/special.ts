import { getMove } from "../../packages/shared/src/chars/index.js";
import { DOWN, LEFT, RIGHT } from "../../packages/shared/src/input/buttons.js";
import { startMove } from "../../packages/shared/src/sim/fighter.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { hold, runFrames, type Frame } from "./run.js";

/** P1 (facing right) motion inputs; the button lands on the last frame. */
export const qcf = (btn: number): Frame[] => [[DOWN, 0], [DOWN | RIGHT, 0], [RIGHT | btn, 0]];
export const qcb = (btn: number): Frame[] => [[DOWN, 0], [DOWN | LEFT, 0], [LEFT | btn, 0]];
export const dp = (btn: number): Frame[] => [[RIGHT, 0], [DOWN, 0], [DOWN | RIGHT | btn, 0]];
export const dd = (btn: number): Frame[] => [[DOWN, 0], [0, 0], [DOWN | btn, 0]];

/** Start move `id` on fighter i directly (bypasses input; used for supers until S7 adds the input gate). */
export function begin(s: MatchState, i: 0 | 1, id: string): void {
  const f = s.fighters[i];
  startMove(f, getMove(f.char, id)!);
}

const free = (st: string): boolean => st === "idle" || st === "crouch" || st === "walkB" || st === "walkF";
/** Run neutral frames (P2 holding `b2`) until both are free; returns defender-free minus attacker-free frame. */
export function advantage(s: MatchState, b2 = 0): number {
  let atk = -1, def = -1;
  for (let n = 1; n <= 200 && (atk < 0 || def < 0); n++) {
    runFrames(s, hold(0, b2, 1));
    if (atk < 0 && free(s.fighters[0].state)) atk = n;
    if (def < 0 && free(s.fighters[1].state)) def = n;
  }
  return def - atk;
}
