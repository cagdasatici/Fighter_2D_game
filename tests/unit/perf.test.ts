import { afterEach, describe, expect, test } from "vitest";
import { createMatch, type FxEvent } from "../../packages/shared/src/index.js";
import { backingScale } from "../../apps/client/src/render/Canvas.js";
import { Fx, POOL_SIZE } from "../../apps/client/src/render/Fx.js";
import { FrameStats, STATS_WINDOW } from "../../apps/client/src/render/FrameStats.js";
import { cacheLayer, getLayer, invalidateLayers, setLayerCanvasFactory, setLayerScale } from "../../apps/client/src/render/Layers.js";

function fakeCanvas(): { width: number; height: number; getContext: () => unknown } {
  const g = { setTransform: () => {} };
  return { width: 0, height: 0, getContext: () => g };
}

describe("PERF layer cache", () => {
  afterEach(() => { setLayerCanvasFactory(null); setLayerScale(1); });
  test("paints once for repeated calls with the same key and repaints after invalidateLayers()", () => {
    setLayerCanvasFactory(fakeCanvas as never);
    let paints = 0;
    const paint = (): void => { paints++; };
    const a = cacheLayer("t.a", 100, 50, paint);
    const b = cacheLayer("t.a", 100, 50, paint);
    expect(paints).toBe(1);
    expect(b).toBe(a);
    expect(getLayer("t.a")).toBe(a);
    invalidateLayers();
    expect(getLayer("t.a")).toBeNull();
    cacheLayer("t.a", 100, 50, paint);
    expect(paints).toBe(2);
  });
  test("a scale change invalidates and the layer is allocated at the backing scale", () => {
    setLayerCanvasFactory(fakeCanvas as never);
    setLayerScale(1);
    const c = cacheLayer("t.s", 100, 50, () => {})!;
    expect(c.width).toBe(100);
    setLayerScale(2);
    const d = cacheLayer("t.s", 100, 50, () => {})!;
    expect(d.width).toBe(200);
    expect(d.height).toBe(100);
  });
  test("backing scale is capped at 2 and floored at 1", () => {
    expect(backingScale(3, 2)).toBe(2);
    expect(backingScale(1, 1)).toBe(1);
    expect(backingScale(0.4, 1)).toBe(1);
    expect(backingScale(1.5, 1.5)).toBe(2);
  });
});

describe("PERF FrameStats", () => {
  test("p95 and average of a known window", () => {
    const s = new FrameStats();
    for (let i = 1; i <= 100; i++) s.push(i);
    expect(s.count).toBe(100);
    expect(s.avg()).toBe(50.5);
    expect(s.p95()).toBe(95);
  });
  test("ring keeps only the last 120 samples", () => {
    const s = new FrameStats();
    for (let i = 0; i < STATS_WINDOW; i++) s.push(1000);
    for (let i = 0; i < STATS_WINDOW; i++) s.push(10);
    expect(s.count).toBe(STATS_WINDOW);
    expect(s.avg()).toBe(10);
    expect(s.p95()).toBe(10);
  });
});

describe("PERF Fx pool", () => {
  test("the pool never grows and lowFx halves the usable cap", () => {
    const fx = new Fx();
    const state = createMatch({ chars: ["bolt", "volt"], stage: "rooftop", seed: 1 });
    const size = fx.pool.length;
    const ev = { kind: "hit", x: 0, y: 5000, by: 0, strength: 2 } as unknown as FxEvent;
    for (let f = 1; f <= 200; f++) { state.frame = f; state.events = [ev, ev]; fx.consume(state); fx.update(); }
    expect(fx.pool.length).toBe(size);
    expect(size).toBe(POOL_SIZE);
    fx.lowFx = true;
    for (let i = 0; i < POOL_SIZE; i++) fx.pool[i]!.alive = false;
    for (let f = 1000; f < 1040; f++) { state.frame = f; state.events = [ev, ev, ev]; fx.consume(state); }
    let upper = 0;
    for (let i = POOL_SIZE >> 1; i < POOL_SIZE; i++) if (fx.pool[i]!.alive) upper++;
    expect(upper).toBe(0);
    expect(fx.liveCount).toBeLessThanOrEqual(POOL_SIZE >> 1);
  });
});
