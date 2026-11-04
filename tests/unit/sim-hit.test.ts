import { describe, expect, it } from "vitest";
import { getMove } from "../../packages/shared/src/chars/index.js";
import { HK, HP, LP, RIGHT } from "../../packages/shared/src/input/buttons.js";
import { pushInput } from "../../packages/shared/src/input/history.js";
import { hits } from "../../packages/shared/src/sim/hit.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { at } from "../helpers/fight.js";
import { hold, runFrames } from "../helpers/run.js";

const p1 = (s: MatchState) => s.fighters[0];
const p2 = (s: MatchState) => s.fighters[1];
/** P1 presses `btn` for one frame then waits `wait` frames (P2 holds `b2` throughout). */
function strike(s: MatchState, btn: number, wait: number, b2 = 0): MatchState {
  return runFrames(s, [[btn, b2], ...hold(0, b2, wait)]);
}
/** Frames after the current one until `pred` holds (max 200). */
function framesUntil(s: MatchState, pred: (s: MatchState) => boolean, b2 = 0): number {
  for (let n = 1; n <= 200; n++) { runFrames(s, [[0, b2]]); if (pred(s)) return n; }
  return -1;
}

describe("S5 hit: reach and damage", () => {
  it("LP hits a standing dummy at 50 px on its first active frame", () => {
    const s = strike(at(50), LP, 3);
    expect(p2(s).hp).toBe(1000);
    runFrames(s, [[0, 0]]);
    expect(p1(s).moveFrame).toBe(5);
    expect(p2(s).state).toBe("hitstun");
    expect(p2(s).hp).toBe(970);
    expect(s.events.map((e) => e.kind)).toEqual(["hit"]);
  });
  it("LP whiffs at 120 px", () => {
    const s = strike(at(120), LP, 14);
    expect(p2(s).hp).toBe(1000);
    expect(p1(s).state).toBe("idle");
  });
  it("damage exact: 5LK 35, 5HK 85, 2HP 75", () => {
    expect(1000 - p2(strike(at(50), 64, 6)).hp).toBe(35);
    expect(1000 - p2(strike(at(50), HK, 10)).hp).toBe(85);
    expect(1000 - p2(runFrames(at(50), [[2 | HP, 0], ...hold(2, 0, 7)])).hp).toBe(75);
  });
});

describe("S5 hit: stun lengths and hitstop", () => {
  it("hitstun length: defender stays in hitstun for hitstop 8 + hitstun 12 frames", () => {
    const s = strike(at(50), LP, 4);
    expect(p2(s).state).toBe("hitstun");
    expect(framesUntil(s, (x) => p2(x).state !== "hitstun")).toBe(8 + 12 + 1);
  });
  it("hitstop both 8 (light) / 11 (heavy)", () => {
    const l = strike(at(50), LP, 4);
    expect([p1(l).hitstop, p2(l).hitstop]).toEqual([8, 8]);
    const h = strike(at(50), HK, 9);
    expect(p2(h).state).toBe("hitstun");
    expect([p1(h).hitstop, p2(h).hitstop]).toEqual([11, 11]);
  });
  it("counter hit: x1.2 damage and +2 hitstun when the defender is in startup", () => {
    const s = runFrames(at(50), [[LP, HP], ...hold(0, 0, 4)]);
    expect(p2(s).hp).toBe(1000 - 36);
    expect(p2(s).stun).toBe(12 + 2);
    expect(s.events[0]?.kind).toBe("counter");
  });
  it("trade: both fighters damaged on the same frame", () => {
    const s = runFrames(at(50), [[LP, LP], ...hold(0, 0, 4)]);
    expect([p1(s).hp, p2(s).hp]).toEqual([970, 970]);
    expect([p1(s).state, p2(s).state]).toEqual(["hitstun", "hitstun"]);
  });
});

describe("S5 hit: hurtExtend", () => {
  it("LP at 110 px whiffs an idle P2 but hits P2's extended hurtbox during 5HK recovery", () => {
    expect(p2(strike(at(110), LP, 10)).hp).toBe(1000);
    // P2 5HK (startup 9, active 10-12) at frame 0; P1 LP at frame 8 → P1 active at P2 moveFrame 13 (recovery).
    // (Earlier, P1's own 5LP hurtExtend would let the 5HK reach P1.)
    const s = runFrames(at(110), [[0, HK], ...hold(0, 0, 7), [LP, 0], ...hold(0, 0, 4)]);
    expect(p1(s).hp).toBe(1000); // 5HK did not reach P1
    expect(p2(s).hp).toBe(970);  // no counter: P2 was past startup
  });
});

describe("S5 hit: juggles and knockdown", () => {
  /** Put P1 into `moveId` at `moveFrame` with P2 juggled 30 px in front, then resolve hits once. */
  function juggleProbe(moveId: string, moveFrame: number): MatchState {
    const s = at(30);
    const a = p1(s), d = p2(s);
    a.state = "attack"; a.move = moveId; a.moveFrame = moveFrame; a.moveHitMask = 0;
    d.state = "juggle"; d.airborne = true; d.y = 3000;
    hits(s);
    return s;
  }
  it("juggle invulnerability: non-launch hits whiff on a juggled fighter", () => {
    expect(p2(juggleProbe("5LP", 5)).hp).toBe(1000);
    expect(getMove("bolt", "jackhammerRise.L")!.hits[0]!.launch).toBeNull();
    expect(p2(juggleProbe("jackhammerRise.L", 4)).hp).toBe(1000);
  });
  it("juggle invulnerability except launch moves", () => {
    const s = juggleProbe("jackhammerRise.L", 7);
    expect(p2(s).hp).toBeLessThan(1000);
    expect(p2(s).state).toBe("juggle");
  });
  it("airborne hit → juggle → knockdown → getup (invulnerable) → idle", () => {
    const s = at(50);
    p2(s).airborne = true; p2(s).y = 2000; p2(s).state = "air";
    strike(s, LP, 4);
    expect(p2(s).state).toBe("juggle");
    expect(framesUntil(s, (x) => p2(x).state === "knockdown")).toBeGreaterThan(0);
    expect(p2(s).invuln).toBe("full");
    // Knockdown and getup cannot be hit.
    for (const st of ["knockdown", "getup"] as const) {
      const t = at(50); p2(t).state = st;
      p1(t).state = "attack"; p1(t).move = "5LP"; p1(t).moveFrame = 5;
      hits(t);
      expect(p2(t).hp).toBe(1000);
    }
    expect(framesUntil(s, (x) => p2(x).state === "getup")).toBe(40 + 1);
    expect(framesUntil(s, (x) => p2(x).state === "idle")).toBe(20 + 1);
    expect(p2(s).comboHits).toBe(0);
  });
  it("2HK sweep knocks a grounded opponent down", () => {
    const s = runFrames(at(60), [[2 | HK, 0], ...hold(2, 0, 9)]);
    expect(p2(s).state).toBe("juggle");
    expect(framesUntil(s, (x) => p2(x).state === "knockdown")).toBeGreaterThan(0);
  });
  it("cross-up block direction is taken relative to the attacker", () => {
    const s = at(50);
    pushInput(p2(s), RIGHT); // away from P1 for P2 standing right of P1
    p1(s).state = "attack"; p1(s).move = "5LP"; p1(s).moveFrame = 5;
    hits(s);
    expect(p2(s).state).toBe("blockstun");
  });
});
