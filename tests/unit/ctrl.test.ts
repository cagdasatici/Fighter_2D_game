import { afterEach, describe, expect, it } from "vitest";
import { getMove } from "../../packages/shared/src/index.js";
import { DEFAULT_KEYS, parseSettings, ACTIONS } from "../../apps/client/src/ui/Settings.js";
import { Keyboard } from "../../apps/client/src/input/Keyboard.js";
import { padBits } from "../../apps/client/src/input/Gamepad.js";
import { METER_MAX } from "../../packages/shared/src/sim/constants.js";
import { at } from "../helpers/fight.js";
import { hold, runFrames } from "../helpers/run.js";
import { MacroPlayer, SP_TABLE } from "../../apps/client/src/input/Macro.js";
import { HP } from "../../packages/shared/src/input/buttons.js";

describe("CTRL settings", () => {
  it("defaults bind SP and SU", () => {
    expect(DEFAULT_KEYS[0].SP).toBe("KeyL"); expect(DEFAULT_KEYS[0].SU).toBe("KeyO");
    expect(DEFAULT_KEYS[1].SP).toBe("Numpad6"); expect(DEFAULT_KEYS[1].SU).toBe("Numpad3");
    expect(ACTIONS).toContain("SP"); expect(ACTIONS).toContain("SU");
  });
  it("migrates stored key maps that lack SP/SU", () => {
    const old = { keys: [{ up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", LP: "KeyU", HP: "KeyI", LK: "KeyJ", HK: "KeyK" }, {}] };
    const s = parseSettings(old);
    expect(s.keys[0].SP).toBe("KeyL"); expect(s.keys[0].SU).toBe("KeyO"); expect(s.keys[1].SU).toBe("Numpad3");
    expect(s.keys[0].LP).toBe("KeyU");
  });
});

const handlers = new Map<string, (e: unknown) => void>();
const target = { addEventListener: (t: string, f: (e: unknown) => void) => handlers.set(t, f), removeEventListener: (t: string) => handlers.delete(t) };
const g = globalThis as Record<string, unknown>;
afterEach(() => { for (const n of ["window", "document", "HTMLInputElement", "HTMLSelectElement"]) delete g[n]; handlers.clear(); });
const down = (code: string, repeat = false) => handlers.get("keydown")!({ code, repeat, target: null, preventDefault: () => {} });

describe("CTRL keyboard edges", () => {
  it("SP/SU keys report one edge per press and add no sim bits", () => {
    g["window"] = target; g["document"] = target; g["HTMLInputElement"] = class {}; g["HTMLSelectElement"] = class {};
    const k = new Keyboard(DEFAULT_KEYS, () => {});
    down("KeyL"); down("KeyL", true); down("Numpad3");
    expect(k.read()).toEqual([0, 0]);
    const e = k.takeEdges();
    expect(e[0]).toEqual({ sp: true, su: false }); expect(e[1]).toEqual({ sp: false, su: true });
    expect(k.takeEdges()[0].sp).toBe(false);
    k.dispose();
  });
  it("RB/RT do not change pad direction/button bits", () => {
    const buttons = Array.from({ length: 16 }, (_, i) => ({ pressed: i === 5 || i === 7 }));
    expect(padBits({ mapping: "standard", axes: [0, 0], buttons })).toBe(0);
  });
});

describe("CTRL meter", () => {
  it("SU with a full meter triggers the super in a sim run", () => {
    for (const char of ["bolt", "volt", "chompa", "kaze", "bao"] as const) {
      const s = at(220, char, "bolt");
      s.fighters[0].meter = METER_MAX;
      const p = new MacroPlayer();
      let b = p.next(0, false, true, { char, facing: 1, charged: false, meterFull: true });
      runFrames(s, [[b, 0]]);
      while (p.playing) { b = p.next(0, false, false, null); runFrames(s, [[b, 0]]); }
      runFrames(s, [[0, 0]]);
      expect(s.fighters[0].move).toBe(SP_TABLE[char].superMove);
    }
  });
  it("attacker and defender meter after a 5HP hit follow the new formula", () => {
    const mv = getMove("bolt", "5HP")!;
    const mo = mv.hits[0]!.meterOnHit;
    const s = at(70, "bolt", "bolt");
    const hp0 = s.fighters[1].hp;
    runFrames(s, [[HP, 0], ...hold(0, 0, 40)]);
    expect(s.fighters[1].hp).toBeLessThan(hp0);
    expect(s.fighters[0].meter).toBe(Math.trunc((mo * 3) / 2));
    expect(s.fighters[1].meter).toBe(Math.trunc(((hp0 - s.fighters[1].hp) * 60) / 100));
  });
});
