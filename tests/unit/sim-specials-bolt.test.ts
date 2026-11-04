import { describe, expect, it } from "vitest";
import { HP, LK, LP, RIGHT } from "../../packages/shared/src/input/buttons.js";
import { PX } from "../../packages/shared/src/fixed.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { at } from "../helpers/fight.js";
import { hold, runFrames } from "../helpers/run.js";
import { advantage, begin, dp, qcb, qcf } from "../helpers/special.js";

const p1 = (s: MatchState) => s.fighters[0];
const p2 = (s: MatchState) => s.fighters[1];

describe("S6 Bolt specials", () => {
  it("rivetShot hits for 70", () => {
    const s = at(250);
    runFrames(s, [...qcf(HP), ...hold(0, 0, 40)]);
    expect(p2(s).hp).toBe(930);
  });
  it("jackhammerRise as anti-air: .L 60+50 = 110, .H 60+80 = 140", () => {
    for (const [btn, total] of [[LP, 110], [HP, 140]] as const) {
      const s = at(40);
      Object.assign(p2(s), { airborne: true, state: "air", y: 4000, vy: 0 });
      runFrames(s, [...dp(btn), ...hold(0, 0, 40)]);
      expect(1000 - p2(s).hp).toBe(total);
    }
  });
  it("jackhammerRise vs a grounded opponent: only the first hit (60) reaches (data finding, see S6.md)", () => {
    const s = at(50);
    runFrames(s, [...dp(LP), ...hold(0, 0, 40)]);
    expect(1000 - p2(s).hp).toBe(60);
  });
  it("jackhammerRise.L is ≤ -20 on block", () => {
    const s = at(50);
    runFrames(s, dp(LP));
    let n = 0;
    while (p2(s).state !== "blockstun" && n++ < 20) runFrames(s, [[0, RIGHT]]);
    expect(advantage(s, RIGHT)).toBeLessThanOrEqual(-20);
  });
  it("DP invuln beats a jump-in whose hit would otherwise land on DP frame 3", () => {
    const setup = (useDp: boolean) => {
      const s = at(40);
      const b = p2(s);
      b.airborne = true; b.state = "attack"; b.move = "j.HP"; b.moveFrame = 7; b.y = 6000; b.vy = 0;
      if (useDp) { begin(s, 0, "jackhammerRise.L"); p1(s).moveFrame = 2; }
      runFrames(s, [[0, 0]]); // j.HP frame 8 (active) vs DP frame 3
      return s;
    };
    expect(p1(setup(false)).hp).toBeLessThan(1000);
    expect(p1(setup(true)).hp).toBe(1000);
  });
  it("hardHatHop: 90 on hit, overhead (stand-blockable); box passes over crouchers (data finding, see S6.md)", () => {
    const s = at(50);
    runFrames(s, qcb(LK));
    expect(p1(s).move).toBe("hardHatHop.L");
    runFrames(s, hold(0, 0, 20));
    expect(p2(s).hp).toBe(910);
    const b = at(50);
    runFrames(b, [...qcb(LK), ...hold(0, RIGHT, 20)]);
    expect(p2(b).hp).toBe(990);
    const c = at(50);
    runFrames(c, [...qcb(LK), ...hold(0, 2 | RIGHT, 20)]);
    expect(p2(c).hp).toBe(1000);
  });
  it("demolitionDrive lockOnHit: 4×50 + 130 = 330, positions locked, final launch", () => {
    const s = at(100);
    begin(s, 0, "demolitionDrive");
    let n = 0;
    while (p2(s).hp === 1000 && n++ < 30) runFrames(s, [[0, 0]]);
    const x0 = p1(s).x, x1 = p2(s).x;
    runFrames(s, hold(0, 0, 18 + 11));
    expect([p1(s).x, p2(s).x]).toEqual([x0, x1]);
    runFrames(s, hold(0, 0, 10));
    expect(1000 - p2(s).hp).toBe(330);
    expect(p2(s).state).toBe("juggle");
    expect(p2(s).vy).toBeGreaterThan(1000);
  });
  it("demolitionDrive blocked: one chip hit and the move ends early", () => {
    const s = at(100);
    begin(s, 0, "demolitionDrive");
    let n = 0;
    while (p2(s).state !== "blockstun" && n++ < 30) runFrames(s, [[0, RIGHT]]);
    expect(p2(s).hp).toBe(985);
    expect(p1(s).moveFrame).toBe(24);
    expect(p1(s).vx).toBe(0);
    expect(PX).toBe(100);
  });
});
