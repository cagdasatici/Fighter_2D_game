import { describe, expect, it } from "vitest";
import { DOWN, LP, RIGHT } from "../../packages/shared/src/input/buttons.js";
import { scaledDamage } from "../../packages/shared/src/sim/hit.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { at } from "../helpers/fight.js";
import { hold, runFrames, type Frame } from "../helpers/run.js";

const p1 = (s: MatchState) => s.fighters[0];
const p2 = (s: MatchState) => s.fighters[1];

describe("S5 combo", () => {
  it("combo scaling sequence 100/100/80/70 (then 60..30, min 1)", () => {
    expect([0, 1, 2, 3, 4, 7, 12].map((i) => scaledDamage(100, i))).toEqual([100, 100, 80, 70, 60, 30, 30]);
    expect(scaledDamage(1, 7)).toBe(1);
  });
  it("chain LP→LP on hit: four jabs deal 30/30/24/21", () => {
    const s = at(45);
    const dmg: number[] = [];
    let hp = 1000;
    for (let j = 0; j < 4; j++) {
      // Press LP (fresh edge), wait for the hit, then ride out hitstop.
      runFrames(s, [[LP, 0], ...hold(0, 0, 4)]);
      dmg.push(hp - p2(s).hp); hp = p2(s).hp;
      runFrames(s, hold(0, 0, 8));
    }
    expect(dmg).toEqual([30, 30, 24, 21]);
    expect(p2(s).comboHits).toBe(4);
  });
  it("chain does not happen on whiff", () => {
    const s = runFrames(at(120), [[LP, 0], ...hold(0, 0, 5), [LP, 0]]);
    expect(p1(s).move).toBe("5LP");
    expect(p1(s).moveFrame).toBe(7);
  });
  const qcfLp = (): Frame[] => [[DOWN, 0], [DOWN | RIGHT, 0], [RIGHT, 0], [RIGHT | LP, 0]];
  it("cancel LP→special on hit (input during hitstop)", () => {
    const s = runFrames(at(50), [[LP, 0], ...hold(0, 0, 4)]);
    expect(p1(s).cancelOk).toBe(true);
    runFrames(s, [...hold(0, 0, 4), ...qcfLp(), [0, 0]]);
    expect(p1(s).move).toBe("rivetShot.L");
  });
  it("cancel LP→special on block", () => {
    const s = runFrames(at(50), [[LP, RIGHT], ...hold(0, RIGHT, 4)]);
    expect(p2(s).state).toBe("blockstun");
    runFrames(s, [...hold(0, 0, 4), ...qcfLp(), [0, 0]]);
    expect(p1(s).move).toBe("rivetShot.L");
  });
  it("no cancel on whiff: the special waits for LP to recover", () => {
    const s = runFrames(at(120), [[LP, 0], ...hold(0, 0, 7), ...qcfLp()]);
    expect(p1(s).move).toBe("5LP");
    expect(p1(s).moveFrame).toBe(12);
  });
  it("comboHits resets when the defender is actionable again", () => {
    const s = runFrames(at(50), [[LP, 0], ...hold(0, 0, 4)]);
    expect(p2(s).comboHits).toBe(1);
    runFrames(s, hold(0, 0, 8 + 13));
    expect(p2(s).state).toBe("idle");
    expect(p2(s).comboHits).toBe(0);
  });
  it("meter gain: attacker +meterOnHit, defender 60% of damage; block gives half", () => {
    const s = runFrames(at(50), [[LP, 0], ...hold(0, 0, 4)]);
    expect([p1(s).meter, p2(s).meter]).toEqual([30, 18]);
    const b = runFrames(at(50), [[LP, RIGHT], ...hold(0, RIGHT, 4)]);
    expect([p1(b).meter, p2(b).meter]).toEqual([15, 0]);
  });
});
