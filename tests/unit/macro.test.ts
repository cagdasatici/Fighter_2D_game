import { describe, expect, it } from "vitest";
const CHAR_IDS_FOR_TEST = ["bolt", "volt", "chompa", "kaze", "bao"] as const;
import { HP, LEFT, RIGHT } from "../../packages/shared/src/input/buttons.js";
import { pushInput } from "../../packages/shared/src/input/history.js";
import { CHARGE_FRAMES, MOTION_WINDOW, detectMotion, resolveRequest, updateCharge, type MotionId } from "../../packages/shared/src/input/motion.js";
import { METER_MAX } from "../../packages/shared/src/sim/constants.js";
import { at } from "../helpers/fight.js";
import { hold, runFrames } from "../helpers/run.js";
import { MacroPlayer, SP_TABLE, buildMacro, buildSuper, macroEntry, spDirection, type SpDir } from "../../apps/client/src/input/Macro.js";

const DIRS: SpDir[] = ["neutral", "up", "back", "down"];
const FACINGS = [1, -1] as const;

function owner() { return { history: new Array<number>(64).fill(0), historyHead: 0, chargeBack: 0, chargeGrace: 0 }; }
function feed(o: ReturnType<typeof owner>, bytes: number[], facing: 1 | -1): void {
  for (const b of bytes) { pushInput(o, b); updateCharge(o, facing); }
}

describe("S14 SP macros pass the motion parser", () => {
  for (const char of CHAR_IDS_FOR_TEST) for (const facing of FACINGS) for (const dir of DIRS) for (const charged of [false, true]) {
    it(`${char} ${dir} facing ${facing}${charged ? " charged" : ""}`, () => {
      const m = macroEntry(char, dir, charged);
      const o = owner();
      if (charged) feed(o, Array(CHARGE_FRAMES + 2).fill(facing === 1 ? LEFT : RIGHT), facing);
      const bytes = buildMacro(char, dir, facing, charged);
      feed(o, bytes, facing);
      expect(bytes[bytes.length - 1]! & m.button).toBe(m.button);
      if (m.motion !== "charge") expect(detectMotion(o, facing, m.motion as MotionId, MOTION_WINDOW[m.motion as MotionId])).toBe(true);
      expect(resolveRequest(o, facing)).toBe(m.motion);
    });
  }
  for (const char of CHAR_IDS_FOR_TEST) for (const facing of FACINGS) {
    it(`${char} super facing ${facing}`, () => {
      const o = owner();
      feed(o, buildSuper(char, facing), facing);
      expect(resolveRequest(o, facing)).toBe("dqcf");
    });
  }
});

describe("S14 SP macros start the listed move in the sim", () => {
  for (const char of CHAR_IDS_FOR_TEST) for (const facing of FACINGS) for (const dir of DIRS) for (const charged of [false, true]) {
    it(`${char} ${dir} facing ${facing}${charged ? " charged" : ""}`, () => {
      const s = at(220, char, "bolt");
      if (facing === -1) { const x = s.fighters[0].x; s.fighters[0].x = s.fighters[1].x; s.fighters[1].x = x; runFrames(s, hold(0, 0, 2)); }
      expect(s.fighters[0].facing).toBe(facing);
      if (charged) runFrames(s, hold(facing === 1 ? LEFT : RIGHT, 0, CHARGE_FRAMES + 2));
      const expected = macroEntry(char, dir, charged).move;
      const seen: string[] = [];
      for (const b of buildMacro(char, dir, facing, charged)) { runFrames(s, [[b, 0]]); seen.push(String(s.fighters[0].move)); }
      runFrames(s, [[0, 0]]); seen.push(String(s.fighters[0].move));
      expect(seen).toContain(expected);
    });
  }
  for (const char of CHAR_IDS_FOR_TEST) {
    it(`${char} super`, () => {
      const s = at(220, char, "bolt");
      s.fighters[0].meter = METER_MAX;
      for (const b of buildSuper(char, 1)) runFrames(s, [[b, 0]]);
      runFrames(s, [[0, 0]]);
      expect(s.fighters[0].move).toBe(SP_TABLE[char].superMove);
    });
  }
});

describe("S14 macro player", () => {
  it("SP direction mapping", () => {
    expect(spDirection(0, 1)).toBe("neutral");
    expect(spDirection(RIGHT, 1)).toBe("neutral");
    expect(spDirection(LEFT, 1)).toBe("back");
    expect(spDirection(RIGHT, -1)).toBe("back");
  });
  it("plays one byte per frame then returns live input; double SP with full meter plays the super", () => {
    const p = new MacroPlayer();
    const ctx = { char: "bolt" as const, facing: 1 as const, charged: false, meterFull: true };
    const out = [p.next(0, true, ctx), p.next(0, false, ctx), p.next(0, false, ctx), p.next(7, false, ctx)];
    expect(out).toEqual(buildMacro("bolt", "neutral", 1, false).concat([7]));
    expect(out[2]! & HP).toBe(HP);
    const sup = [p.next(0, true, ctx)];
    while (p.playing) sup.push(p.next(0, false, ctx));
    expect(sup).toEqual(buildSuper("bolt", 1));
  });
  it("double SP without full meter restarts the normal macro", () => {
    const p = new MacroPlayer();
    const ctx = { char: "bolt" as const, facing: 1 as const, charged: false, meterFull: false };
    p.next(0, true, ctx);
    expect(p.next(0, true, ctx)).toBe(buildMacro("bolt", "neutral", 1, false)[0]);
  });
});
