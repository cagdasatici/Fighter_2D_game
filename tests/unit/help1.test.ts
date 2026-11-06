// HELP1: move list rows per character, hint trigger logic, hints setting.
import { describe, expect, it } from "vitest";
import { CHARS, METER_MAX, THROW_RANGE, createMatch, type CharId } from "../../packages/shared/src/index.js";
import { controlLabels, moveListRows } from "../../apps/client/src/ui/MoveList.js";
import { HINT_FRAMES, HintTracker, hintText, hintTriggers } from "../../apps/client/src/ui/Hints.js";
import { easySpecials } from "../../apps/client/src/ui/HowToPlay.js";
import { DEFAULT_KEYS, defaultSettings, parseSettings } from "../../apps/client/src/ui/Settings.js";

const IDS = Object.keys(CHARS) as CharId[];

describe("move list rows", () => {
  it.each(IDS)("%s: 4 specials by name with SP, throw and super (no motions)", (id) => {
    const rows = moveListRows(id, controlLabels(DEFAULT_KEYS[0], 0));
    expect(rows).toHaveLength(6);
    for (const [name, how] of rows.slice(0, 4)) { expect(name).not.toMatch(/[↓↘]|\+ (LP|HP|LK|HK)/); expect(how).toMatch(/SP \[/); }
    expect(rows[4]![0]).toBe("Throw");
    expect(rows[4]![1]).toContain("U + J"); // bound LP + LK
    expect(rows[5]![0]).toMatch(/^Super: [^(]+$/);
    expect(rows[5]![1]).toContain("O"); // bound SU key
  });
  it("shows rebound keys; pad labels for both players, touch for P1 only", () => {
    const k = { ...DEFAULT_KEYS[1], SU: "KeyZ" };
    const p2 = moveListRows("bolt", controlLabels(k, 1));
    expect(p2[5]![1]).toContain("Z");
    expect(p2[5]![1]).toMatch(/pad RT/);
    expect(p2[5]![1]).not.toMatch(/touch/);
    expect(p2[0]![1]).toMatch(/pad RB/);
    expect(moveListRows("bolt", controlLabels(DEFAULT_KEYS[0], 0))[5]![1]).toMatch(/pad RT.*touch SUPER/);
  });
  it("Moves tab rows are plain SP + direction with move names, no motion notation", () => {
    expect(easySpecials("bolt")[0]).toEqual(["SP", "Rivet Shot"]);
    expect(easySpecials("bolt")[3]![0]).toBe("↓ + SP");
    for (const id of IDS) for (const [, t] of easySpecials(id)) expect(t).not.toMatch(/\+ (LP|HP|LK|HK|P|K)\)/);
  });
});

describe("hint triggers", () => {
  const fight = () => { const s = createMatch({ chars: ["bolt", "volt"], stage: "rooftop", seed: 1 }); s.phase = "fight"; s.fighters[0]!.x = 0; s.fighters[1]!.x = THROW_RANGE * 3; return s; };
  it("round 1 start shows the special hint only in fight phase", () => {
    const s = fight();
    expect(hintTriggers(s, 0, new Set())).toEqual(["special"]);
    s.phase = "intro";
    expect(hintTriggers(s, 0, new Set())).toEqual([]);
    s.phase = "fight"; s.round = 2;
    expect(hintTriggers(s, 0, new Set())).toEqual([]);
  });
  it("super fires when the meter is full, throw when within THROW_RANGE and grounded", () => {
    const s = fight(); s.round = 2;
    s.fighters[0]!.meter = METER_MAX - 1;
    expect(hintTriggers(s, 0, new Set())).toEqual([]);
    s.fighters[0]!.meter = METER_MAX;
    expect(hintTriggers(s, 0, new Set())).toEqual(["super"]);
    s.fighters[1]!.x = THROW_RANGE + 1;
    expect(hintTriggers(s, 0, new Set(["super"]))).toEqual([]);
    s.fighters[1]!.x = THROW_RANGE;
    expect(hintTriggers(s, 0, new Set(["super"]))).toEqual(["throw"]);
    s.fighters[0]!.airborne = true;
    expect(hintTriggers(s, 0, new Set(["super"]))).toEqual([]);
  });
  it("tracker shows each hint once per match, for ~2 s with fade, queued; reset re-arms", () => {
    const s = fight(); s.fighters[0]!.meter = METER_MAX; s.fighters[1]!.x = 100;
    const t = new HintTracker();
    t.update(s, 0);
    expect(t.current?.kind).toBe("special");
    expect(t.current!.alpha).toBeGreaterThan(0);
    const order: string[] = [t.current!.kind];
    for (let i = 0; i < HINT_FRAMES * 3 + 5; i++) { t.update(s, 0); const k = t.current?.kind; if (k && order[order.length - 1] !== k) order.push(k); }
    expect(order).toEqual(["special", "super", "throw"]);
    expect(t.current).toBeNull();
    t.update(s, 0); expect(t.current).toBeNull(); // nothing repeats
    t.reset(); t.update(s, 0); expect(t.current?.kind).toBe("special");
  });
  it("alpha fades at both ends and text names the SU key", () => {
    const s = fight(); const t = new HintTracker(); t.update(s, 0);
    const a0 = t.current!.alpha;
    for (let i = 0; i < HINT_FRAMES / 2; i++) t.update(s, 0);
    expect(t.current!.alpha).toBe(1);
    for (let i = 0; i < HINT_FRAMES / 2 - 3; i++) t.update(s, 0);
    expect(t.current!.alpha).toBeLessThan(a0 + 1);
    expect(t.current!.alpha).toBeLessThan(0.3);
    expect(hintText("super", "O / pad RT / touch SUPER")).toBe("SUPER ready: press O / pad RT / touch SUPER");
    expect(hintText("throw", "")).toBe("Close! LP+LK = throw");
  });
});

describe("hints setting", () => {
  it("defaults on, persists booleans, ignores junk", () => {
    expect(defaultSettings().hints).toBe(true);
    expect(parseSettings({ hints: false }).hints).toBe(false);
    expect(parseSettings({ hints: "no" }).hints).toBe(true);
  });
});
