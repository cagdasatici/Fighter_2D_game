// TXT: display copy, settings reset/rebind feedback, menu focus wrap, touch easy-special list, admin room create body.
import { describe, expect, it } from "vitest";
import { CPU_DIFFICULTIES } from "../../packages/shared/src/ai/cpu.js";
import { DIFFICULTY_INFO, NET_ERRORS, keyLabel, netErrorText, stageName } from "../../apps/client/src/ui/text.js";
import { STAGES } from "../../apps/client/src/ui/CharSelect.js";
import { defaultSettings, rebind, rebindMessage, resetSettings } from "../../apps/client/src/ui/Settings.js";
import { nextIndex } from "../../apps/client/src/ui/dom.js";
import { easySpecials } from "../../apps/client/src/ui/HowToPlay.js";
import { createAdminApi } from "../../apps/client/src/admin/api.js";

describe("TXT display names", () => {
  it("every stage has a capitalised display name (no raw ids)", () => {
    for (const s of STAGES) { const n = stageName(s); expect(n).not.toBe(s); expect(n[0]).toBe(n[0]!.toUpperCase()); }
    expect(stageName("bamboo")).toBe("Bamboo Grove");
  });
  it("key labels are short and readable", () => {
    expect(keyLabel("KeyW")).toBe("W"); expect(keyLabel("Digit1")).toBe("1"); expect(keyLabel("Numpad4")).toBe("Num 4");
    expect(keyLabel("ArrowLeft")).toBe("←"); expect(keyLabel("ShiftLeft")).toBe("L Shift"); expect(keyLabel("F5")).toBe("F5");
  });
  it("every CPU difficulty has a name and a one-line description", () => {
    for (const d of CPU_DIFFICULTIES) { expect(DIFFICULTY_INFO[d].name.length).toBeGreaterThan(0); expect(DIFFICULTY_INFO[d].blurb).toMatch(/\.$/); }
  });
  it("network errors map to helpful sentences, unknown errors to a fallback", () => {
    expect(netErrorText({ code: "ROOM_FULL" })).toBe(NET_ERRORS.ROOM_FULL);
    expect(netErrorText({ code: "INVITE_INVALID" })).toMatch(/invitation/);
    expect(netErrorText(new Error("x"))).toBe("Something went wrong. Try again.");
  });
});

describe("TXT settings", () => {
  it("reset restores every default in place", () => {
    const s = defaultSettings();
    s.effectsVolume = 0.1; s.musicOn = false; s.difficulty = "hard"; s.keys[0].LP = "KeyZ";
    const same = s; resetSettings(s);
    expect(same).toEqual(defaultSettings());
  });
  it("rebind reports swaps and refuses reserved keys", () => {
    const s = defaultSettings();
    const r = rebind(s, 0, "LP", "KeyK");
    expect(r).toEqual({ ok: true, reserved: false, swapped: { p: 0, action: "HK" } });
    expect(rebindMessage(r, 0, "LP", "KeyK", "KeyU")).toBe("P1 Light Punch is now K. It was used by P1 Heavy Kick, which moved to U.");
    const bad = rebind(s, 0, "LP", "Enter");
    expect(bad.ok).toBe(false); expect(s.keys[0].LP).toBe("KeyK");
    expect(rebindMessage(bad, 0, "LP", "Enter", "KeyK")).toMatch(/reserved/);
    expect(rebind(s, 1, "up", "KeyZ").swapped).toBeNull();
  });
});

describe("TXT menus", () => {
  it("focus wraps both ways and starts at the ends", () => {
    expect(nextIndex(-1, 4, true)).toBe(0); expect(nextIndex(-1, 4, false)).toBe(3);
    expect(nextIndex(3, 4, true)).toBe(0); expect(nextIndex(0, 4, false)).toBe(3); expect(nextIndex(0, 0, true)).toBe(-1);
  });
  it("touch easy-special list uses move names from data, two specials and super", () => {
    const c = easySpecials("chompa");
    expect(c).toHaveLength(3);
    expect(c[2]![0]).toBe("SUPER");
    for (const [, name] of easySpecials("bolt")) expect(name).not.toMatch(/\./); // display names, not ids like rivetShot.H
  });
});

describe("TXT admin page api", () => {
  it("createRoom sends the 1v1 schema body (name + bots 0..1)", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const api = createAdminApi(() => undefined, async (url, init) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const json = url.endsWith("/login") ? { csrfToken: "t", expiresAt: 1 } : { roomCode: "abc", name: "Den", kind: "fight", players: 0, bots: 1, listed: true };
      return new Response(JSON.stringify(json), { status: 200, headers: { "content-type": "application/json" } });
    });
    await api.login("pw");
    const row = await api.createRoom("Den", 1);
    expect(calls[1]).toEqual({ url: "/api/admin/rooms", body: { name: "Den", bots: 1 } });
    expect(row.kind).toBe("fight");
  });
});
