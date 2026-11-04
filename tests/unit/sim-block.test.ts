import { describe, expect, it } from "vitest";
import { DOWN, HP, LK, LP, RIGHT } from "../../packages/shared/src/input/buttons.js";
import { pushInput } from "../../packages/shared/src/input/history.js";
import { hits } from "../../packages/shared/src/sim/hit.js";
import { WALL_MAX } from "../../packages/shared/src/sim/physics.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { at } from "../helpers/fight.js";
import { hold, runFrames } from "../helpers/run.js";

const p1 = (s: MatchState) => s.fighters[0];
const p2 = (s: MatchState) => s.fighters[1];
const BACK2 = RIGHT, DOWNBACK2 = DOWN | RIGHT; // P2 faces left
const isFree = (st: string) => st === "idle" || st === "walkB" || st === "crouch" || st === "walkF";

describe("S5 block", () => {
  it("blockstun length: hitstop 8 + blockstun 9", () => {
    const s = runFrames(at(50), [[LP, BACK2], ...hold(0, BACK2, 4)]);
    expect(p2(s).state).toBe("blockstun");
    expect(p2(s).hp).toBe(1000);
    let n = 0;
    while (p2(s).state === "blockstun") { runFrames(s, [[0, BACK2]]); n++; }
    expect(n).toBe(8 + 9 + 1);
  });
  it("frame advantage LP on block (Bolt) = +1 under spec §8.1/§8.3 counting (task text says +2: BLOCKED)", () => {
    const s = runFrames(at(50), [[LP, BACK2], ...hold(0, BACK2, 4)]);
    let atk = -1, def = -1;
    for (let n = 1; n <= 40 && (atk < 0 || def < 0); n++) {
      runFrames(s, [[0, BACK2]]);
      if (atk < 0 && isFree(p1(s).state)) atk = n;
      if (def < 0 && isFree(p2(s).state)) def = n;
    }
    expect(def - atk).toBe(1);
  });
  it("chip: 5HP blocked takes 8; chip can't KO", () => {
    const s = runFrames(at(50), [[HP, BACK2], ...hold(0, BACK2, 7)]);
    expect(p2(s).hp).toBe(992);
    const k = at(50); p2(k).hp = 5;
    runFrames(k, [[HP, BACK2], ...hold(0, BACK2, 7)]);
    expect(p2(k).hp).toBe(1);
  });
  it("low must be crouch-blocked: 2LK hits a stand-blocker, is blocked by down-back", () => {
    const a = runFrames(at(50), [[DOWN | LK, BACK2], ...hold(DOWN, BACK2, 5)]);
    expect(p2(a).state).toBe("hitstun");
    const b = runFrames(at(50), [[DOWN | LK, DOWNBACK2], ...hold(DOWN, DOWNBACK2, 5)]);
    expect(p2(b).state).toBe("blockstun");
  });
  it("overhead must be stand-blocked: Kaze 6LK hits a crouch-blocker, is blocked standing", () => {
    // Kaze 6LK: startup 14, hit frames 15-18.
    const a = runFrames(at(60, "kaze"), [[RIGHT | LK, DOWNBACK2], ...hold(0, DOWNBACK2, 14)]);
    expect(p2(a).state).toBe("hitstun");
    const b = runFrames(at(60, "kaze"), [[RIGHT | LK, BACK2], ...hold(0, BACK2, 14)]);
    expect(p2(b).state).toBe("blockstun");
  });
  it("airborne can't block", () => {
    const s = at(50);
    p2(s).airborne = true; p2(s).y = 2000; p2(s).state = "air";
    pushInput(p2(s), BACK2);
    p1(s).state = "attack"; p1(s).move = "5LP"; p1(s).moveFrame = 5;
    hits(s);
    expect(p2(s).state).toBe("juggle");
  });
  it("pushback on block: defender slides exactly 900 units over 8 frames after hitstop", () => {
    const s = runFrames(at(50), [[LP, BACK2], ...hold(0, BACK2, 4)]);
    const x0 = p2(s).x;
    runFrames(s, hold(0, 0, 8 + 8));
    expect(p2(s).x - x0).toBe(900);
  });
  it("pushback transfer at wall: attacker takes the pushback", () => {
    const s = at(50);
    p2(s).x = WALL_MAX; p1(s).x = WALL_MAX - 5000;
    runFrames(s, [[LP, 0], ...hold(0, 0, 4)]);
    expect(p2(s).state).toBe("hitstun");
    const a0 = p1(s).x;
    runFrames(s, hold(0, 0, 8 + 8));
    expect(p2(s).x).toBe(WALL_MAX);
    expect(a0 - p1(s).x).toBe(900);
  });
});
