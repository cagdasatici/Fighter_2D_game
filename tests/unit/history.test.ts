import { describe, expect, it } from "vitest";
import { DOWN, LP } from "../../packages/shared/src/input/buttons.js";
import { heldFrames, inputAt, pressed, pushInput } from "../../packages/shared/src/input/history.js";

const INPUT_HISTORY = 40; // spec §4; sim/constants.ts arrives in S4
const mk = () => ({ history: new Array<number>(INPUT_HISTORY).fill(0), historyHead: 0 });

describe("input history", () => {
  it("wraps around at 40", () => {
    const f = mk();
    for (let i = 1; i <= 45; i++) pushInput(f, i);
    expect(f.historyHead).toBe(45 % INPUT_HISTORY);
    expect(inputAt(f, 0)).toBe(45);
    expect(inputAt(f, 5)).toBe(40);
    expect(inputAt(f, 39)).toBe(6);
    expect(f.history.length).toBe(INPUT_HISTORY);
  });
  it("pressed detects rising edge only", () => {
    const f = mk();
    pushInput(f, 0); pushInput(f, LP); pushInput(f, LP);
    expect(pressed(f, LP)).toBe(false);
    expect(pressed(f, LP, 1)).toBe(true);
    pushInput(f, 0); pushInput(f, LP | DOWN);
    expect(pressed(f, LP)).toBe(true);
    expect(pressed(f, DOWN)).toBe(true);
  });
  it("heldFrames counts consecutive newest frames", () => {
    const f = mk();
    pushInput(f, 0); pushInput(f, DOWN); pushInput(f, DOWN | LP); pushInput(f, DOWN);
    expect(heldFrames(f, (b) => (b & DOWN) !== 0)).toBe(3);
    expect(heldFrames(f, (b) => (b & LP) !== 0)).toBe(0);
    const g = mk();
    expect(heldFrames(g, () => true)).toBe(INPUT_HISTORY);
  });
});
