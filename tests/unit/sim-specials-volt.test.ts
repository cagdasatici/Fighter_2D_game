import { describe, expect, it } from "vitest";
import { DOWN, HK, HP, LEFT, LK, LP, RIGHT } from "../../packages/shared/src/input/buttons.js";
import { PX } from "../../packages/shared/src/fixed.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { at } from "../helpers/fight.js";
import { hold, runFrames } from "../helpers/run.js";
import { advantage, begin, dd, dp, qcb, qcf } from "../helpers/special.js";

const p1 = (s: MatchState) => s.fighters[0];
const p2 = (s: MatchState) => s.fighters[1];
void [DOWN, HK, HP, LEFT, LK, LP, RIGHT, PX, advantage, begin, dd, dp, qcb, qcf];

describe("S6 Volt specials", () => {
  it("coilWhip.L: 80 dmg, reach 150 px (hits at 171 px gap, whiffs at 172)", () => {
    const hitAt = (gap: number) => { const s = at(gap, "volt"); runFrames(s, [...qcb(LP), ...hold(0, 0, 20)]); return 1000 - p2(s).hp; };
    expect(hitAt(171)).toBe(80);
    expect(hitAt(172)).toBe(0);
  });
  it("coilWhip.L on block = blockstun 15 − (3 + 22) = −10", () => {
    const s = at(120, "volt");
    runFrames(s, qcb(LP));
    let n = 0;
    while (p2(s).state !== "blockstun" && n++ < 20) runFrames(s, [[0, RIGHT]]);
    expect(advantage(s, RIGHT)).toBe(-10);
  });
  it("staticSpark hits 2 × 60", () => {
    const s = at(200, "volt");
    runFrames(s, [...qcf(LP), ...hold(0, 0, 80)]);
    expect(1000 - p2(s).hp).toBe(120);
  });
  it("liveWireHop: first hit 30 on f6; later hits rise out of reach of a grounded opponent (data finding, S6.md)", () => {
    const s = at(40, "volt");
    runFrames(s, [...dp(LK), ...hold(0, 0, 40)]);
    expect(1000 - p2(s).hp).toBe(30);
  });
  it("liveWireHop is strike-invulnerable f1-7 (5LP active on its frame 3 does nothing)", () => {
    const s = at(40, "volt");
    runFrames(s, [...dp(LK), [0, LP], ...hold(0, 0, 5)]);
    expect(p1(s).hp).toBe(950);
  });
  it("overload: 5 lightning columns at +80..+480 px on frames 10/18/26/34/42", () => {
    const s = at(400, "volt");
    p2(s).invuln = "full"; p2(s).invulnFrames = 999; // columns must not be consumed by hits
    begin(s, 0, "overload");
    const xs: number[] = [];
    for (let n = 0; n < 45; n++) {
      runFrames(s, [[0, 0]]);
      for (const pr of s.projectiles) if (!xs.includes(pr.x - p1(s).x)) xs.push(pr.x - p1(s).x);
    }
    expect(xs).toEqual([80, 180, 280, 380, 480].map((x) => x * PX));
  });
  it("overload column hits for 70 and is blockable mid", () => {
    const s = at(80, "volt");
    begin(s, 0, "overload");
    runFrames(s, hold(0, 0, 12));
    expect(p2(s).hp).toBe(930);
    const b = at(80, "volt");
    begin(b, 0, "overload");
    runFrames(b, hold(0, RIGHT, 12));
    expect(p2(b).hp).toBe(988);
  });
});
