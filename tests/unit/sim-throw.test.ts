import { describe, expect, it } from "vitest";
import { LEFT, LK, LP } from "../../packages/shared/src/input/buttons.js";
import { hits } from "../../packages/shared/src/sim/hit.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { at } from "../helpers/fight.js";
import { hold, runFrames } from "../helpers/run.js";

const p1 = (s: MatchState) => s.fighters[0];
const p2 = (s: MatchState) => s.fighters[1];
const T = LP | LK;
/** Throw pressed at frame 0; connects on move frame 6 (THROW_STARTUP + 1). */
const grabbed = (gap: number, dir = 0): MatchState => runFrames(at(gap), [[T | dir, 0], ...hold(dir, 0, 5)]);

describe("S5 throw", () => {
  it("throw connects at 70 px, not 71", () => {
    const s = grabbed(70);
    expect([p1(s).state, p2(s).state]).toEqual(["throwing", "thrown"]);
    expect(grabbed(71).fighters[1].state).toBe("idle");
  });
  it("LP then LK on the next frame still throws (light normal upgrades within 2 frames)", () => {
    const s = runFrames(at(60), [[LP, 0], [T, 0], ...hold(0, 0, 6)]);
    expect(p2(s).state).toBe("thrown");
  });
  it("throw resolves after 30 frames: 120 damage, knockdown 80 px in front", () => {
    const s = grabbed(60);
    runFrames(s, hold(0, 0, 29));
    expect(p2(s).hp).toBe(880);
    expect(p2(s).state).toBe("knockdown");
    expect(p2(s).x - p1(s).x).toBe(8000);
    expect(s.events.some((e) => e.kind === "throw")).toBe(true);
  });
  it("holding back on start throws backward (sides swap)", () => {
    const s = grabbed(60, LEFT);
    runFrames(s, hold(0, 0, 29));
    expect(p2(s).x - p1(s).x).toBe(-8000);
  });
  it("tech within 7 frames separates both", () => {
    const s = grabbed(60);
    runFrames(s, [...hold(0, 0, 6), [0, T]]);
    expect([p1(s).state, p2(s).state]).toEqual(["techSep", "techSep"]);
    expect(p2(s).hp).toBe(1000);
    runFrames(s, hold(0, 0, 17));
    expect(p2(s).x - p1(s).x).toBe(6000 + 6000); // grabbed at 60 px, pushed 6000 apart
    expect([p1(s).state, p2(s).state]).toEqual(["idle", "idle"]);
  });
  it("tech on the 8th frame is too late", () => {
    const s = grabbed(60);
    runFrames(s, [...hold(0, 0, 7), [0, T]]);
    expect(p2(s).state).toBe("thrown");
  });
  it("throw whiff recovery: 5+1+22 frames in attack", () => {
    const s = runFrames(at(120), [[T, 0]]);
    let n = 1;
    while (p1(s).state === "attack") { runFrames(s, [[0, 0]]); n++; }
    expect(n).toBe(5 + 1 + 22 + 1);
  });
  it("airborne and hitstun opponents can't be thrown", () => {
    for (const st of ["air", "hitstun"] as const) {
      const s = at(60);
      p2(s).state = st; p2(s).airborne = st === "air"; p2(s).y = st === "air" ? 2000 : 0;
      p1(s).state = "attack"; p1(s).move = "throw"; p1(s).moveFrame = 6;
      hits(s);
      expect(p2(s).state).toBe(st);
    }
  });
  it("command grab uses grab.range/damage and can't be teched (Chompa gulpGrab.L, 80 px)", () => {
    const probe = (gap: number) => {
      const s = at(gap, "chompa");
      p1(s).state = "attack"; p1(s).move = "gulpGrab.L"; p1(s).moveFrame = 6;
      hits(s);
      return s;
    };
    expect(p2(probe(81)).state).toBe("idle");
    const s = probe(80);
    expect(p2(s).state).toBe("thrown");
    runFrames(s, [[0, T], ...hold(0, 0, 3), [0, T]]);
    expect(p2(s).state).toBe("thrown");
    runFrames(s, hold(0, 0, 30));
    expect(p2(s).hp).toBe(1000 - 200);
  });
});
