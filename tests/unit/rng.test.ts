import { describe, expect, it } from "vitest";
import { nextRng, rngInt } from "../../packages/shared/src/rng.js";

describe("rng", () => {
  it("nextRng(1) first 3 values are fixed", () => {
    const a = nextRng(1), b = nextRng(a), c = nextRng(b);
    expect([a, b, c]).toEqual([270369, 67634689, 2647435461]);
  });
  it("rngInt stays in 0..n-1 and advances state", () => {
    const s = { rng: 12345 };
    for (let i = 0; i < 1000; i++) {
      const prev = s.rng;
      const v = rngInt(s, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(7);
      expect(s.rng).not.toBe(prev);
      expect(s.rng).not.toBe(0);
    }
  });
});
