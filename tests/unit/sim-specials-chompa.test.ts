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

const charge = (btn: number) => [...hold(LEFT, 0, 41), [RIGHT | btn, 0] as [number, number]];
const spin = (btn: number) => [[RIGHT, 0], [DOWN, 0], [LEFT, 0], [1, 0], [RIGHT | btn, 0]] as [number, number][];

describe("S6 Chompa specials", () => {
  it("gulpGrab range: L 80/81 px, H 65/66 px; damage on the spit frame (50)", () => {
    for (const [btn, range, dmg] of [[LP, 80, 200], [HP, 65, 240]] as const) {
      const ok = at(range, "chompa"); runFrames(ok, spin(btn));
      expect(p1(ok).move).toBe(btn === LP ? "gulpGrab.L" : "gulpGrab.H");
      runFrames(ok, hold(0, 0, 6));
      expect(p2(ok).state).toBe("thrown");
      runFrames(ok, hold(0, 0, 60));
      expect(1000 - p2(ok).hp).toBe(dmg);
      const no = at(range + 1, "chompa"); runFrames(no, [...spin(btn), ...hold(0, 0, 8)]);
      expect(p2(no).state).not.toBe("thrown");
    }
  });
  it("360 input during jumpSquat frames 1-2 cancels the jump into gulpGrab", () => {
    const s = at(60, "chompa");
    runFrames(s, [[RIGHT, 0], [DOWN, 0], [LEFT, 0], [UP_, 0], [RIGHT | UP_ | LP, 0]]);
    expect(p1(s).move).toBe("gulpGrab.L");
    expect(p1(s).airborne).toBe(false);
  });
  it("eggLob direct hit: 80 and knockdown", () => {
    const s = at(180, "chompa");
    runFrames(s, qcb(HP));
    let n = 0;
    while (p2(s).hp === 1000 && n++ < 80) runFrames(s, [[0, 0]]);
    expect(p2(s).hp).toBe(920);
    expect(p2(s).state).toBe("juggle");
  });
  it("tailSpin needs charge: no charge → no tailSpin; 41 back frames → tailSpin.L", () => {
    const no = at(300, "chompa");
    runFrames(no, [[LEFT, 0], [LEFT, 0], [RIGHT | LK, 0]]);
    expect(p1(no).move ?? "").not.toContain("tailSpin");
    const yes = at(300, "chompa");
    runFrames(yes, charge(LK));
    expect(p1(yes).move).toBe("tailSpin.L");
  });
  it("tailSpin hits 3 × 35 (scaled 35/35/28) with knockdown on the last hit", () => {
    const s = at(80, "chompa");
    begin(s, 0, "tailSpin.L");
    runFrames(s, hold(0, 0, 70));
    expect(1000 - p2(s).hp).toBe(35 + 35 + 28);
  });
  it("tailSpin hits an opponent behind it (two-sided box)", () => {
    const s = at(80, "chompa");
    p2(s).x = p1(s).x - 4000; // 40 px behind Chompa (facing right)
    begin(s, 0, "tailSpin.L");
    p1(s).vx = 0;
    runFrames(s, hold(0, 0, 8));
    expect(p2(s).hp).toBeLessThan(1000);
  });
  it("stampedeRoll: 6 contacts × 55 max, last launches; rebounds once off the wall", () => {
    const s = at(100, "chompa");
    begin(s, 0, "stampedeRoll");
    runFrames(s, hold(0, 0, 150));
    expect(p1(s).spCount & 255).toBe(6);
    expect(p2(s).hp).toBeLessThan(1000);
    const w = at(200, "chompa");
    w.fighters[0].x = 50000; w.fighters[1].x = 42000; // opponent behind, roll heads for the right wall
    begin(w, 0, "stampedeRoll");
    let reversed = false;
    for (let n = 0; n < 56 && !reversed; n++) { runFrames(w, [[0, 0]]); reversed = p1(w).vx < 0; }
    expect(reversed).toBe(true);
    expect(p1(w).facing).toBe(1);
  });
});
const UP_ = 1;
