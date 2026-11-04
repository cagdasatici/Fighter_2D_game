import type { CharDef } from "../chars/types.js";

export type Phase = "intro" | "fight" | "roundEnd" | "matchEnd";
export type FState =
  | "idle" | "walkF" | "walkB" | "crouch" | "jumpSquat" | "air" | "land"
  | "dashF" | "dashB" | "attack" | "hitstun" | "blockstun" | "juggle"
  | "knockdown" | "getup" | "thrown" | "throwing" | "techSep" | "ko" | "win";
export interface Fighter {
  char: CharDef["id"];
  x: number; y: number; vx: number; vy: number;
  facing: 1 | -1;
  hp: number; meter: number;
  state: FState; stateFrame: number;
  move: string | null; moveFrame: number;
  moveHitMask: number;
  stun: number;
  hitstop: number;
  pushRemain: number; pushPerFrame: number;
  crouching: boolean; airborne: boolean;
  invuln: "none" | "full" | "strike" | "projectile"; invulnFrames: number;
  comboHits: number;
  history: number[]; historyHead: number;
  buffered: number;
  chargeBack: number; chargeGrace: number;
  lastPressFrame: number;
  cancelOk: boolean;
  counterArmed: boolean;
  airJumps: number;
  gravityScale: number;
  wins: number;
  // S6 special-move bookkeeping (sim/specials.ts).
  lockLeft: number;                                // lockOnHit: follow-up hits left incl. the final one (0 = no lock)
  lockTimer: number;                               // frames until the next lock hit
  rehit: number;                                   // stampedeRoll: frames until the box may hit again
  spCount: number;                                 // stampedeRoll: contacts so far
  superScale: number;                              // S7: % scale fixed by the current super's first hit (0 = not yet)
}
export interface Projectile {
  owner: 0 | 1; kind: string; x: number; y: number; vx: number; vy: number; gravity: number;
  w: number; h: number; hits: number; hitInterval: number; cooldown: number; life: number;
  def: string;
  exploding: number;
}
export interface FxEvent { frame: number; kind: "hit" | "block" | "counter" | "throw" | "super" | "ko" | "parry" | "projectileClash" | "whiff" | "land" | "special"; x: number; y: number; strength: 0 | 1 | 2; by: 0 | 1 }
export type StageId = "rooftop" | "bamboo" | "volcano";
export interface MatchState {
  frame: number; rng: number; phase: Phase; phaseFrame: number;
  round: number; timer: number;
  superFreeze: number; superBy: 0 | 1 | null;
  fighters: [Fighter, Fighter];
  projectiles: Projectile[];
  events: FxEvent[];
  stage: StageId;
  winner: 0 | 1 | null; drawRounds: number;
}
