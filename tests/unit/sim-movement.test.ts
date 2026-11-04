import { describe, expect, it } from "vitest";
import { CHARS, type CharId } from "../../packages/shared/src/chars/index.js";
import { DOWN, LEFT, RIGHT, UP } from "../../packages/shared/src/input/buttons.js";
import { checksum } from "../../packages/shared/src/sim/checksum.js";
import {
  GRAVITY, JUMP_SQUAT, LANDING_RECOVERY, MAX_FIGHTER_GAP, STAGE_LEFT, STAGE_RIGHT,
} from "../../packages/shared/src/sim/constants.js";
import { cloneState, createMatch } from "../../packages/shared/src/sim/state.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { hold, runFrames, skipIntro, type Frame } from "../helpers/run.js";

const ALL: CharId[] = ["bolt", "volt", "chompa", "kaze", "bao"];
const fresh = (a: CharId = "bolt", b: CharId = "bolt"): MatchState =>
  skipIntro(createMatch({ chars: [a, b], stage: "rooftop", seed: 7 }));
const p1 = (s: MatchState) => s.fighters[0];

/** Run frames one at a time and record states of P1. */
function trace(s: MatchState, frames: Frame[]) {
  const out: { state: string; x: number; y: number; facing: number }[] = [];
  for (const f of frames) { runFrames(s, [f]); const x = p1(s); out.push({ state: x.state, x: x.x, y: x.y, facing: x.facing }); }
  return out;
}
/** Discrete apex/airtime for vy -= G; y += vy (spec §8.2). */
function discreteJump(vy0: number) {
  let vy = vy0, y = 0, apex = 0, t = 0;
  do { vy -= GRAVITY; y += vy; t++; if (y > apex) apex = y; } while (!(y <= 0 && vy < 0));
  return { apex, t };
}

describe("S4 intro", () => {
  it("ignores inputs for 120 frames then fights", () => {
    const s = createMatch({ chars: ["bolt", "bolt"], stage: "rooftop", seed: 1 });
    runFrames(s, hold(RIGHT, 0, 119));
    expect(s.phase).toBe("intro");
    expect(p1(s).x).toBe(-14000);
    runFrames(s, hold(RIGHT, 0, 1));
    expect(s.phase).toBe("fight");
  });
});

describe("S4 walk", () => {
  for (const id of ALL) {
    it(`${id} walk speeds`, () => {
      const c = CHARS[id];
      const s = fresh(id, id);
      runFrames(s, hold(RIGHT, 0, 10));
      expect(p1(s).state).toBe("walkF");
      expect(p1(s).x).toBe(-14000 + 10 * c.walkFwd);
      const x0 = p1(s).x;
      runFrames(s, hold(0, 0, 1));
      runFrames(s, hold(LEFT, 0, 10));
      expect(p1(s).state).toBe("walkB");
      expect(p1(s).x).toBe(x0 - 10 * c.walkBack);
    });
  }
  it("crouch stops and sets crouching", () => {
    const s = fresh();
    runFrames(s, hold(DOWN | RIGHT, 0, 5));
    expect(p1(s).state).toBe("crouch");
    expect(p1(s).crouching).toBe(true);
    expect(p1(s).x).toBe(-14000);
  });
});

describe("S4 jump", () => {
  it("jumpSquat lasts 4 frames, airtime and apex match the discrete formula, 3 frames landing", () => {
    const s = fresh();
    const t = trace(s, [...hold(UP, 0, 1), ...hold(0, 0, 60)]);
    const squat = t.filter((r) => r.state === "jumpSquat").length;
    const air = t.filter((r) => r.state === "air").length;
    const land = t.filter((r) => r.state === "land").length;
    const apex = Math.max(...t.map((r) => r.y));
    const d = discreteJump(CHARS.bolt.jumpVy);
    expect(squat).toBe(JUMP_SQUAT);
    expect(land).toBe(LANDING_RECOVERY);
    expect(air).toBe(d.t - 1); // landing frame is already "land"
    expect(d.t).toBe(36);
    expect(apex).toBe(d.apex);
    expect(apex).toBe(14310); // continuous 1650²/(2·90)=15125; spec §8.2 order gives 14310
    expect(t.at(-1)!.state).toBe("idle");
  });
  it("forward jump travels jumpVx per airborne frame", () => {
    const s = fresh();
    runFrames(s, [...hold(UP | RIGHT, 0, 1), ...hold(0, 0, JUMP_SQUAT)]);
    expect(p1(s).vx).toBe(CHARS.bolt.jumpVx);
    expect(p1(s).x).toBe(-14000 + CHARS.bolt.jumpVx);
  });
});

describe("S4 dash", () => {
  for (const id of ALL) {
    it(`${id} dash distances`, () => {
      const c = CHARS[id];
      const s = fresh(id, id);
      s.fighters[1].x = 36000; // away from pushbox, inside the 520 px gap
      runFrames(s, [[RIGHT, 0], [0, 0], [RIGHT, 0]]);
      expect(p1(s).state).toBe("dashF");
      runFrames(s, hold(0, 0, c.dashFwd.frames + 1));
      expect(p1(s).x).toBe(-14000 + c.walkFwd + c.dashFwd.frames * c.dashFwd.speed); // frame 1 of 6,5,6 walks
      const x0 = p1(s).x;
      s.fighters[1].x = x0 + 20000; // keep the backdash inside the 520 px gap
      runFrames(s, [[LEFT, 0], [0, 0], [LEFT, 0]]);
      expect(p1(s).state).toBe("dashB");
      expect(p1(s).invuln).toBe("strike");
      runFrames(s, hold(0, 0, c.dashBack.frames + 1));
      expect(p1(s).invuln).toBe("none");
      expect(p1(s).x).toBe(x0 - c.walkBack - c.dashBack.frames * c.dashBack.speed);
    });
  }
  it("held forward is a walk, not a dash", () => {
    const s = fresh();
    runFrames(s, hold(RIGHT, 0, 20));
    expect(p1(s).state).toBe("walkF");
  });
});

describe("S4 walls, gap, pushboxes", () => {
  it("wall clamps and the fighter at the wall is not pushed", () => {
    const s = fresh();
    runFrames(s, hold(LEFT, LEFT, 400));
    expect(p1(s).x).toBe(STAGE_LEFT + 2000);
    expect(s.fighters[1].x).toBe(STAGE_LEFT + 2000 + 4000);
    const t = fresh();
    runFrames(t, hold(RIGHT, RIGHT, 400));
    expect(t.fighters[1].x).toBe(STAGE_RIGHT - 2000);
  });
  it("gap is clamped to 520 px; the mover is the one stopped", () => {
    const s = fresh();
    runFrames(s, hold(LEFT, 0, 200));
    expect(s.fighters[1].x - p1(s).x).toBe(MAX_FIGHTER_GAP);
    expect(s.fighters[1].x).toBe(14000);
    const t = fresh();
    runFrames(t, hold(LEFT, RIGHT, 200));
    expect(t.fighters[1].x - p1(t).x).toBe(MAX_FIGHTER_GAP);
    expect(t.fighters[1].x + p1(t).x).toBe(0);
  });
  it("walking into the opponent separates by pushbox width", () => {
    const s = fresh();
    runFrames(s, hold(RIGHT, 0, 200));
    expect(s.fighters[1].x - p1(s).x).toBe(4000);
    const v = fresh("chompa", "bao");
    runFrames(v, hold(RIGHT, LEFT, 200));
    expect(v.fighters[1].x - v.fighters[0].x).toBe(idivHalf(50 + 52));
  });
});
const idivHalf = (w: number) => Math.trunc((w * 100) / 2);

describe("S4 cross-up and facing", () => {
  it("jumping over switches sides; facing holds mid-air and updates after landing", () => {
    const s = fresh();
    s.fighters[0].x = -2500; s.fighters[1].x = 2500;
    const t = trace(s, [...hold(UP | RIGHT, 0, 1), ...hold(0, 0, 60)]);
    const crossed = t.find((r) => r.state === "air" && r.x > s.fighters[1].x);
    expect(crossed).toBeDefined();
    for (const r of t) if (r.state === "air") expect(r.facing).toBe(1);
    expect(p1(s).x).toBeGreaterThan(s.fighters[1].x);
    expect(p1(s).facing).toBe(-1);
    expect(s.fighters[1].facing).toBe(1);
  });
});

describe("S4 Kaze double jump", () => {
  it("only once per airtime, only for Kaze", () => {
    const s = fresh("kaze", "bolt");
    runFrames(s, [...hold(UP, 0, 1), ...hold(0, 0, JUMP_SQUAT + 14)]);
    expect(p1(s).vy).toBeLessThan(600);
    runFrames(s, [[UP, 0]]);
    expect(p1(s).airJumps).toBe(1);
    expect(p1(s).vy).toBe(1400 - GRAVITY);
    runFrames(s, [[0, 0], ...hold(0, 0, 10), [UP, 0]]);
    expect(p1(s).airJumps).toBe(1);
    expect(p1(s).vy).toBeLessThan(1400 - 11 * GRAVITY);
    runFrames(s, hold(0, 0, 120));
    expect(p1(s).airJumps).toBe(0);
    const b = fresh("bolt", "bolt");
    runFrames(b, [...hold(UP, 0, 1), ...hold(0, 0, JUMP_SQUAT + 10), [0, 0], [UP, 0]]);
    expect(p1(b).airJumps).toBe(0);
  });
});

describe("S4 determinism", () => {
  it("same inputs give same checksum; clone replays identically", () => {
    const script: Frame[] = [];
    for (let i = 0; i < 600; i++) script.push([[RIGHT, UP | RIGHT, LEFT, 0, DOWN][i % 5]!, [LEFT, 0, UP, RIGHT | UP][i % 4]!]);
    const a = fresh(), b = fresh();
    runFrames(a, script.slice(0, 300));
    const c = cloneState(a);
    runFrames(a, script.slice(300)); runFrames(b, script); runFrames(c, script.slice(300));
    expect(checksum(a)).toBe(checksum(b));
    expect(checksum(c)).toBe(checksum(a));
    expect(checksum(a)).toBeGreaterThanOrEqual(0);
  });
});
