import { describe, expect, it } from "vitest";
import { getMove } from "../../packages/shared/src/chars/index.js";
import { DOWN, HK, LEFT, RIGHT } from "../../packages/shared/src/input/buttons.js";
import { step } from "../../packages/shared/src/sim/step.js";
import { AdvantageMeter, advantageText, applyTrainingRefills, dummyInput } from "../../apps/client/src/app/Training.js";
import { notation } from "../../apps/client/src/ui/HowToPlay.js";
import { DEFAULT_KEYS, defaultSettings, parseSettings, rebind } from "../../apps/client/src/ui/Settings.js";
import { buildMaps } from "../../apps/client/src/input/Keyboard.js";
import { at } from "../helpers/fight.js";

describe("S11 settings", () => {
  it("parses untrusted storage and falls back to defaults", () => {
    expect(parseSettings(null)).toEqual(defaultSettings());
    const s = parseSettings({ effectsVolume: 9, musicVolume: "x", musicOn: false, difficulty: "insane", keys: [{ LP: "KeyZ", HP: "Escape" }] });
    expect(s.effectsVolume).toBe(1); expect(s.musicVolume).toBe(0.25); expect(s.musicOn).toBe(false);
    expect(s.difficulty).toBe("normal"); expect(s.keys[0].LP).toBe("KeyZ"); expect(s.keys[0].HP).toBe(DEFAULT_KEYS[0].HP);
  });
  it("rebinding swaps a key already in use so no key drives two actions", () => {
    const s = defaultSettings();
    rebind(s, 0, "LP", "KeyK"); // KeyK was P1 HK
    expect(s.keys[0].LP).toBe("KeyK"); expect(s.keys[0].HK).toBe("KeyU");
    const [m0] = buildMaps(s.keys);
    expect(m0.KeyK).toBe(16); expect(m0.KeyU).toBe(HK);
  });
});

describe("S11 how to play", () => {
  it("renders motion notation arrows", () => {
    expect(notation(getMove("bolt", "jackhammerRise.H")!, true)).toBe("→↓↘ + P");
    expect(notation(getMove("bolt", "demolitionDrive")!)).toBe("↓↘→↓↘→ + P");
    expect(notation(getMove("bolt", "6HP")!)).toBe("→ + HP");
  });
});

describe("S11 training", () => {
  it("dummy behaviours produce the expected bytes", () => {
    const s = at(200);
    expect(dummyInput(s, "crouch")).toBe(DOWN);
    expect(dummyInput(s, "stand")).toBe(0);
    s.fighters[0].state = "attack"; s.fighters[0].move = "2LK"; s.fighters[0].moveFrame = 1;
    expect(dummyInput(s, "block")).toBe(DOWN | RIGHT); // P2 is right of P1: block back = right, low = crouch
    expect(LEFT).toBe(4);
  });
  it("infinite hp refills and the frame-advantage readout matches the move data", () => {
    const s = at(60);
    const meter = new AdvantageMeter();
    const opts = { dummy: "block" as const, infiniteHp: true, infiniteMeter: true };
    let prev = 0;
    for (let i = 0; i < 60; i++) {
      const b0 = i === 0 ? DOWN | 64 : 0; // one 2LK (low, blocked by crouch-back)
      step(s, [b0, dummyInput(s, opts.dummy)]); prev = b0;
      applyTrainingRefills(s, opts); meter.observe(s);
    }
    expect(prev).toBe(0);
    expect(meter.last).not.toBeNull();
    expect(s.fighters[0].meter).toBe(1000);
    expect(advantageText(2)).toBe("+2"); expect(advantageText(-3)).toBe("-3");
    // Bolt 2LK on block: blockstun 9 vs remaining active + recovery 10 -> a small number of frames
    expect(Math.abs(meter.last!)).toBeLessThan(10);
  });
});
