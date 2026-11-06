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

describe("S6 Kaze specials", () => {
  it("shurikenFan.H: two stars, the second 4 frames later at offset (40,60)", () => {
    const s = at(500, "kaze");
    runFrames(s, [...qcf(HP), ...hold(0, 0, 9)]);
    expect(s.projectiles.length).toBe(1);
    expect(s.projectiles[0]!.y).toBe(80 * PX);
    runFrames(s, hold(0, 0, 4));
    expect(s.projectiles.length).toBe(2);
    expect(s.projectiles[1]!.y).toBe(60 * PX);
    expect(s.projectiles[1]!.x).toBe(p1(s).x + 40 * PX + 800);
  });
  it("shurikenFan.L: one star, 40 damage", () => {
    const s = at(200, "kaze");
    runFrames(s, [...qcf(LP), ...hold(0, 0, 40)]);
    expect(1000 - p2(s).hp).toBe(40);
  });
  it("airShuriken travels down-forward (vx 700, vy −500)", () => {
    const s = at(400, "kaze");
    Object.assign(p1(s), { airborne: true, state: "air", y: 20000, vy: 0 });
    runFrames(s, [...qcf(LP), ...hold(0, 0, 10)]);
    expect(p1(s).move).toBe("airShuriken.L");
    expect(s.projectiles[0]?.vx).toBe(700);
    expect(s.projectiles[0]?.vy).toBe(-500);
  });
  it("risingCrane.H as anti-air: 40 + 90 = 130", () => {
    const s = at(40, "kaze");
    Object.assign(p2(s), { airborne: true, state: "air", y: 4000, vy: 0 });
    runFrames(s, [...dp(HK), ...hold(0, 0, 40)]);
    expect(1000 - p2(s).hp).toBe(130);
  });
  it("thousandShadows lockOnHit: 8 × 30 + 100 = 340, final launch", () => {
    const s = at(150, "kaze");
    begin(s, 0, "thousandShadows");
    runFrames(s, hold(0, 0, 100));
    expect(1000 - p2(s).hp).toBe(340);
  });
});
