import { describe, expect, it } from "vitest";
import { cleanSocd, DOWN, LEFT, LP, numpad, RIGHT, UP } from "../../packages/shared/src/input/buttons.js";

describe("cleanSocd", () => {
  it("left+right = neutral", () => { expect(cleanSocd(LEFT | RIGHT | LP)).toBe(LP); });
  it("up+down = up", () => { expect(cleanSocd(UP | DOWN)).toBe(UP); });
  it("all four = up", () => { expect(cleanSocd(UP | DOWN | LEFT | RIGHT)).toBe(UP); });
  it("leaves clean input alone", () => { expect(cleanSocd(DOWN | RIGHT)).toBe(DOWN | RIGHT); });
});

describe("numpad", () => {
  // [byte, expected facing right, expected facing left]
  const cases: [number, number, number][] = [
    [DOWN | LEFT, 1, 3], [DOWN, 2, 2], [DOWN | RIGHT, 3, 1],
    [LEFT, 4, 6], [0, 5, 5], [RIGHT, 6, 4],
    [UP | LEFT, 7, 9], [UP, 8, 8], [UP | RIGHT, 9, 7],
  ];
  for (const [b, r, l] of cases) {
    it(`byte ${b} -> ${r} (facing 1), ${l} (facing -1)`, () => {
      expect(numpad(b, 1)).toBe(r);
      expect(numpad(b, -1)).toBe(l);
    });
  }
});
