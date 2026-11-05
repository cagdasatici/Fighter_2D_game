import { describe, expect, it } from "vitest";
import { CHARS, type CharId } from "../../packages/shared/src/chars/index.js";
import { DOWN, LEFT, RIGHT, UP } from "../../packages/shared/src/input/buttons.js";
import { checksum } from "../../packages/shared/src/sim/checksum.js";
import {
  PLATFORMS, PLATFORM_HIGH, PLATFORM_LOW, PLATFORM_MIN_APEX,
} from "../../packages/shared/src/sim/platforms.js";
import { createMatch } from "../../packages/shared/src/sim/state.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { hold, runFrames, skipIntro } from "../helpers/run.js";

const fresh = (c: CharId = "bolt"): MatchState => {
  const s = skipIntro(createMatch({ chars: [c, "bolt"], stage: "rooftop", seed: 7 }));
  s.fighters[1].x = 10000;
  return s;
};
const p1 = (s: MatchState) => s.fighters[0];
const lowLeft = PLATFORMS.rooftop[1]!;

describe("PLAT constants", () => {
  it("match the lowest neutral jump apex across CHARS", () => {
    let minApex = Infinity;
    for (const id of Object.keys(CHARS) as CharId[]) {
      const s = fresh(id);
      p1(s).x = 0;
      let apex = 0;
      runFrames(s, hold(UP, 0, 1));
      for (let i = 0; i < 120; i++) { runFrames(s, hold(0, 0, 1)); apex = Math.max(apex, p1(s).y); }
      minApex = Math.min(minApex, apex);
    }
    expect(minApex).toBe(PLATFORM_MIN_APEX);
    expect(PLATFORM_LOW).toBe(Math.floor((minApex * 55) / 10000) * 100);
    expect(PLATFORM_HIGH).toBe(Math.floor((minApex * 92) / 10000) * 100);
  });
});

describe("PLAT landing", () => {
  it("lands on LOW from a jump over it", () => {
    const s = fresh();
    p1(s).x = lowLeft.x0 - 3000;
    runFrames(s, hold(UP | RIGHT, 0, 1));
    runFrames(s, hold(0, 0, 80));
    expect(p1(s).airborne).toBe(false);
    expect(p1(s).platform).toBe(1);
    expect(p1(s).y).toBe(PLATFORM_LOW);
  });
  it("lands on LOW when falling onto it and records the platform", () => {
    const s = fresh();
    p1(s).x = -25000; p1(s).y = PLATFORM_LOW + 3000; p1(s).airborne = true; p1(s).vy = -50; p1(s).state = "air";
    runFrames(s, hold(0, 0, 30));
    expect(p1(s).airborne).toBe(false);
    expect(p1(s).y).toBe(PLATFORM_LOW);
    expect(p1(s).platform).toBe(1);
  });
  it("passes up through from below", () => {
    const s = fresh("volt");
    p1(s).x = -25000;
    runFrames(s, hold(UP, 0, 1));
    for (let i = 0; i < 40; i++) { runFrames(s, hold(0, 0, 1)); if (p1(s).y > PLATFORM_LOW + 500) break; }
    expect(p1(s).y).toBeGreaterThan(PLATFORM_LOW);
    expect(p1(s).airborne).toBe(true);
    expect(p1(s).platform).toBe(-1);
  });
  it("walking off the edge falls without using a jump", () => {
    const s = fresh();
    p1(s).x = lowLeft.x1 - 200; p1(s).y = PLATFORM_LOW; p1(s).platform = 1;
    runFrames(s, hold(RIGHT, 0, 6));
    expect(p1(s).airborne).toBe(true);
    expect(p1(s).airJumps).toBe(0);
    expect(p1(s).platform).toBe(-1);
    runFrames(s, hold(0, 0, 60));
    expect(p1(s).airborne).toBe(false);
    expect(p1(s).y).toBe(0);
  });
});

describe("PLAT drop-through", () => {
  const onPlatform = (): MatchState => {
    const s = fresh();
    p1(s).x = -25000; p1(s).y = PLATFORM_LOW; p1(s).platform = 1;
    return s;
  };
  it("a single down only crouches", () => {
    const s = onPlatform();
    runFrames(s, hold(DOWN, 0, 20));
    expect(p1(s).state).toBe("crouch");
    expect(p1(s).y).toBe(PLATFORM_LOW);
    expect(p1(s).airborne).toBe(false);
  });
  it("down double-tap drops through to the ground", () => {
    const s = onPlatform();
    runFrames(s, [...hold(DOWN, 0, 3), ...hold(0, 0, 2), ...hold(DOWN, 0, 2)]);
    expect(p1(s).airborne).toBe(true);
    expect(p1(s).platform).toBe(-1);
    runFrames(s, hold(0, 0, 60));
    expect(p1(s).airborne).toBe(false);
    expect(p1(s).y).toBe(0);
  });
});

describe("PLAT determinism", () => {
  it("same inputs give the same hash", () => {
    const run = (): number => {
      const s = fresh();
      p1(s).x = -25000; p1(s).y = PLATFORM_LOW; p1(s).platform = 1;
      runFrames(s, [...hold(DOWN, 0, 3), ...hold(0, LEFT, 2), ...hold(DOWN, 0, 2), ...hold(UP | RIGHT, 0, 1), ...hold(0, 0, 120)]);
      return checksum(s);
    };
    expect(run()).toBe(run());
  });
});
