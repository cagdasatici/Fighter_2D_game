import { CHARS } from "../chars/index.js";
import type { CharId } from "../chars/types.js";
import { INPUT_HISTORY, ROUND_FRAMES, START_X } from "./constants.js";
import type { Fighter, MatchState, StageId } from "./types.js";

export function createFighter(char: CharId, x: number, facing: 1 | -1): Fighter {
  return {
    char, x, y: 0, vx: 0, vy: 0, facing,
    hp: CHARS[char].hp, meter: 0,
    state: "idle", stateFrame: 1,
    move: null, moveFrame: 0, moveHitMask: 0,
    stun: 0, hitstop: 0, pushRemain: 0, pushPerFrame: 0,
    crouching: false, airborne: false,
    invuln: "none", invulnFrames: 0, comboHits: 0,
    history: new Array<number>(INPUT_HISTORY).fill(0), historyHead: 0,
    buffered: 0, chargeBack: 0, chargeGrace: 0, lastPressFrame: 0,
    cancelOk: false, counterArmed: false, airJumps: 0, gravityScale: 100, wins: 0,
    lockLeft: 0, lockTimer: 0, rehit: 0, spCount: 0, superScale: 0,
  };
}

export function createMatch(opts: { chars: [CharId, CharId]; stage: StageId; seed: number }): MatchState {
  return {
    // seed 0 would freeze xorshift32, so it maps to 1.
    frame: 0, rng: opts.seed >>> 0 || 1, phase: "intro", phaseFrame: 0,
    round: 1, timer: ROUND_FRAMES, superFreeze: 0, superBy: null,
    fighters: [createFighter(opts.chars[0], -START_X, 1), createFighter(opts.chars[1], START_X, -1)],
    projectiles: [], events: [], stage: opts.stage, winner: null, drawRounds: 0,
  };
}

// Spec §3.3 says structuredClone; the shared tsconfig has no DOM/node lib for it. State is plain
// JSON data (no undefined, no classes), so a JSON round-trip is equivalent.
export function cloneState(s: MatchState): MatchState { return JSON.parse(JSON.stringify(s)) as MatchState; }
