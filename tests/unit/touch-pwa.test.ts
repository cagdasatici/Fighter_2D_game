import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { DOWN, HK, LEFT, LP, RIGHT, UP } from "../../packages/shared/src/input/buttons.js";
import { axesBits, padBits } from "../../apps/client/src/input/Gamepad.js";
import { stickBits } from "../../apps/client/src/input/Touch.js";
import { DEFAULT_LAYOUT, parseLayout, validateLayout } from "../../apps/client/src/ui/LayoutEdit.js";

describe("S14 touch stick (14 px deadzone, 45° sectors)", () => {
  it("maps directions", () => {
    expect(stickBits(10, 0)).toBe(0);
    expect(stickBits(30, 0)).toBe(RIGHT);
    expect(stickBits(0, -30)).toBe(UP);
    expect(stickBits(-30, 30)).toBe(LEFT | DOWN);
    expect(stickBits(30, 8)).toBe(RIGHT); // 15° below horizontal stays in the RIGHT sector
  });
});

describe("S14 gamepad (deadzone 0.4, standard mapping)", () => {
  it("axes and buttons", () => {
    expect(axesBits(0.3, 0)).toBe(0);
    expect(axesBits(0.7, 0.7)).toBe(RIGHT | DOWN);
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    buttons[2] = { pressed: true }; buttons[1] = { pressed: true }; buttons[14] = { pressed: true }; buttons[15] = { pressed: true };
    expect(padBits({ mapping: "standard", axes: [0, 0], buttons })).toBe(LP | HK); // left+right cleaned to neutral
  });
});

describe("S14 touch layout", () => {
  it("default is safe on iPad sizes; overlap and left-half are rejected", () => {
    expect(validateLayout(DEFAULT_LAYOUT, 1024, 768)).toEqual([]);
    expect(validateLayout(DEFAULT_LAYOUT, 1366, 1024)).toEqual([]);
    expect(validateLayout({ ...DEFAULT_LAYOUT, SP: { dx: 140, dy: 140 } }, 1024, 768).some((s) => s.includes("overlap"))).toBe(true);
    expect(validateLayout({ ...DEFAULT_LAYOUT, SP: { dx: 900, dy: 300 } }, 1024, 768).some((s) => s.includes("right half"))).toBe(true);
    expect(parseLayout({ LP: { dx: 1 } })).toBeNull();
  });
});

describe("S14 service worker routing", () => {
  it("never touches api, matchmaking or other origins; caches hashed assets", () => {
    const self: Record<string, unknown> = { addEventListener: () => {}, location: { origin: "http://h" } };
    runInNewContext(readFileSync("apps/client/public/sw.js", "utf8"), { self, URL });
    const r = (self["__swRouting"] as { routeRequest: (u: string, m: string, o: string) => string }).routeRequest;
    expect(r("http://h/api/time", "GET", "http://h")).toBe("bypass");
    expect(r("http://h/matchmake/joinById/x", "GET", "http://h")).toBe("bypass");
    expect(r("http://other/assets/a.js", "GET", "http://h")).toBe("bypass");
    expect(r("http://h/assets/a.js", "POST", "http://h")).toBe("bypass");
    expect(r("http://h/assets/a.js", "GET", "http://h")).toBe("cache-first");
    expect(r("http://h/", "GET", "http://h")).toBe("network-first");
  });
  it("manifest is landscape fullscreen with icons", () => {
    const m = JSON.parse(readFileSync("apps/client/public/manifest.webmanifest", "utf8")) as { orientation: string; display: string; icons: unknown[] };
    expect(m).toMatchObject({ orientation: "landscape", display: "fullscreen" });
    expect(m.icons.length).toBe(3);
  });
});
