import { describe, expect, test } from "vitest";
import { METER_MAX } from "../../packages/shared/src/index.js";
import { ease, moodFor, squashFor } from "../../apps/client/src/render/clips.js";
import { lowHealth, meterSegments, METER_SEGMENTS } from "../../apps/client/src/render/Hud.js";
import { light, mix, shade } from "../../apps/client/src/render/Puppet.js";
import { boltJitter, hash01 } from "../../apps/client/src/render/Projectiles.js";
import { cachedGrad } from "../../apps/client/src/render/Stage.js";

describe("GFX pose easing and squash", () => {
  test("ease is smoothstep: fixed ends, symmetric, clamped", () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(0.25)).toBeLessThan(0.25);
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
  });
  test("hit squash peaks on impact and decays to zero", () => {
    const at = (stateFrame: number): number => squashFor({ state: "hitstun", stateFrame, vy: 0, airborne: false });
    expect(at(0)).toBeGreaterThan(0);
    expect(at(4)).toBeLessThan(at(0));
    expect(at(8)).toBe(0);
    expect(squashFor({ state: "air", stateFrame: 3, vy: 1400, airborne: true })).toBeLessThan(0);
    expect(squashFor({ state: "idle", stateFrame: 3, vy: 0, airborne: false })).toBe(0);
  });
  test("mood follows fighter state", () => {
    expect(moodFor({ state: "hitstun" })).toBe("hurt");
    expect(moodFor({ state: "attack" })).toBe("fierce");
    expect(moodFor({ state: "idle" })).toBe("normal");
  });
});

describe("GFX colour helpers", () => {
  test("shade/light return hex so tints can chain, and are memoised", () => {
    expect(shade("#ffffff", 25)).toBe("#bfbfbf");
    expect(light("#000000", 50)).toBe("#808080");
    expect(mix(shade("#ff0000"), "#ffffff", 1)).toBe("#ffffff");
    expect(shade("#123456")).toBe(shade("#123456"));
    expect(mix("rgba(0,0,0,1)", "#ffffff", 0.5)).toBe("rgba(0,0,0,1)");
  });
});

describe("GFX HUD helpers", () => {
  test("low health is at or below 25% and above zero", () => {
    expect(lowHealth(250, 1000)).toBe(true);
    expect(lowHealth(251, 1000)).toBe(false);
    expect(lowHealth(0, 1000)).toBe(false);
  });
  test("meter segments count only full quarters", () => {
    expect(meterSegments(0)).toBe(0);
    expect(meterSegments(METER_MAX / 4 - 1)).toBe(0);
    expect(meterSegments(METER_MAX / 4)).toBe(1);
    expect(meterSegments(METER_MAX)).toBe(METER_SEGMENTS);
    expect(meterSegments(METER_MAX * 2)).toBe(METER_SEGMENTS);
  });
});

describe("GFX projectile/stage helpers", () => {
  test("lightning jitter is deterministic per seed with pinned ends", () => {
    const a = boltJitter(7), b = boltJitter(7), c = boltJitter(8);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(a[0]).toBe(0);
    expect(a[8]).toBe(0);
    for (const v of a) expect(Math.abs(v)).toBeLessThanOrEqual(9);
    for (let i = 0; i < 100; i++) { const h = hash01(i); expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(1); }
  });
  test("cachedGrad builds a gradient once per context and key", () => {
    let made = 0;
    const ctx = {} as CanvasRenderingContext2D, other = {} as CanvasRenderingContext2D;
    const make = (): CanvasGradient => { made++; return {} as CanvasGradient; };
    const g1 = cachedGrad(ctx, "k", make), g2 = cachedGrad(ctx, "k", make);
    expect(g1).toBe(g2);
    expect(made).toBe(1);
    cachedGrad(other, "k", make);
    expect(made).toBe(2);
  });
});
