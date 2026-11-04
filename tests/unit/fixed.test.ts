import { describe, expect, it } from "vitest";
import { clamp, idiv, sign } from "../../packages/shared/src/fixed.js";

describe("fixed", () => {
  it("idiv truncates toward zero", () => {
    expect(idiv(-7, 2)).toBe(-3);
    expect(idiv(7, 2)).toBe(3);
    expect(idiv(7, -2)).toBe(-3);
  });
  it("clamp", () => { expect(clamp(5, 0, 3)).toBe(3); expect(clamp(-1, 0, 3)).toBe(0); expect(clamp(2, 0, 3)).toBe(2); });
  it("sign", () => { expect(sign(-9)).toBe(-1); expect(sign(0)).toBe(0); expect(sign(4)).toBe(1); });
});
