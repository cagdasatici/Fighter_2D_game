import { describe, expect, test } from "vitest";
import { createMatch, type FxEvent } from "../../packages/shared/src/index.js";
import { Fx, POOL_SIZE } from "../../apps/client/src/render/Fx.js";
import { comboText, roundText, timerDigits } from "../../apps/client/src/render/Hud.js";

describe("S10 HUD helpers", () => {
  test("timer digits are two-digit whole seconds, rounded up and clamped", () => {
    expect(timerDigits(99 * 60)).toBe("99");
    expect(timerDigits(600)).toBe("10");
    expect(timerDigits(541)).toBe("10");
    expect(timerDigits(540)).toBe("09");
    expect(timerDigits(1)).toBe("01");
    expect(timerDigits(0)).toBe("00");
    expect(timerDigits(200 * 60)).toBe("99");
  });
  test("combo text only from 2 hits", () => {
    expect(comboText(0)).toBe("");
    expect(comboText(1)).toBe("");
    expect(comboText(2)).toBe("2 HITS");
    expect(comboText(13)).toBe("13 HITS");
  });
  test("round text: ROUND n for 60 frames, then FIGHT!", () => {
    expect(roundText("intro", 0, 2)).toBe("ROUND 2");
    expect(roundText("intro", 59, 2)).toBe("ROUND 2");
    expect(roundText("intro", 60, 2)).toBe("FIGHT!");
    expect(roundText("fight", 0, 2)).toBe("");
  });
});

describe("S10 Fx", () => {
  const kinds: FxEvent["kind"][] = ["hit", "block", "counter", "throw", "super", "ko", "parry", "projectileClash", "whiff", "land", "special"];
  test("particle pool never exceeds 256 under 1000 events", () => {
    const s = createMatch({ chars: ["bolt", "volt"], stage: "rooftop", seed: 1 });
    const fx = new Fx();
    for (let i = 0; i < 1000; i++) {
      s.frame = i;
      s.events = [{ frame: i, kind: kinds[i % kinds.length]!, x: 0, y: 6000, strength: (i % 3) as 0 | 1 | 2, by: (i & 1) as 0 | 1 }];
      fx.consume(s);
      expect(fx.pool.length).toBe(POOL_SIZE);
      expect(fx.liveCount).toBeLessThanOrEqual(POOL_SIZE);
    }
    expect(fx.liveCount).toBeGreaterThan(0);
  });
  test("events of a frame are consumed exactly once (lastFxFrame guard)", () => {
    const s = createMatch({ chars: ["bolt", "volt"], stage: "rooftop", seed: 1 });
    s.frame = 5;
    s.events = [{ frame: 5, kind: "hit", x: 0, y: 6000, strength: 0, by: 0 }];
    const fx = new Fx();
    fx.consume(s);
    const once = fx.liveCount;
    fx.consume(s);
    expect(once).toBe(14); // 6 spikes + 4 debris + shock + star + glow + 1 streak
    expect(fx.liveCount).toBe(once);
    for (let i = 0; i < 30; i++) fx.update();
    expect(fx.liveCount).toBe(0);
  });
});
