import { describe, expect, test } from "vitest";
import { cloneState, createMatch, type FxEvent } from "../../packages/shared/src/index.js";
import { Camera, TRAUMA_DECAY } from "../../apps/client/src/render/Camera.js";
import { Fx, POOL_SIZE } from "../../apps/client/src/render/Fx.js";
import { TRAIL_POINTS, Trails } from "../../apps/client/src/render/Trails.js";
import { popScale, comboColor, POP_FRAMES } from "../../apps/client/src/render/Hud.js";
import { comboRate, cuesForFrame } from "../../apps/client/src/audio/sfx.js";

const fresh = (): ReturnType<typeof createMatch> => createMatch({ chars: ["bolt", "volt"], stage: "rooftop", seed: 1 });
const hit = (strength: 0 | 1 | 2, frame: number): FxEvent => ({ frame, kind: "hit", x: 0, y: 6000, strength, by: 0 });

describe("FX camera trauma", () => {
  test("trauma clamps to 1 and decays to 0", () => {
    const cam = new Camera(), s = fresh();
    for (let i = 1; i <= 10; i++) { s.frame = i; s.events = [hit(2, i)]; cam.update(s); }
    expect(cam.trauma).toBeLessThanOrEqual(1);
    expect(cam.trauma).toBeGreaterThan(0.5);
    s.events = [];
    for (let i = 0; i < Math.ceil(1 / TRAUMA_DECAY) + 2; i++) { s.frame = 100 + i; cam.update(s); }
    expect(cam.trauma).toBe(0);
    expect(cam.shakeX).toBe(0);
  });
  test("shake amplitude is trauma squared times 6 px and off when disabled", () => {
    const cam = new Camera(), s = fresh();
    s.frame = 1; s.events = [hit(2, 1)]; cam.update(s);
    expect(Math.abs(cam.shakeX)).toBeLessThanOrEqual(0.7 * 0.7 * 6 + 1e-9);
    const off = new Camera(); off.shakeOn = false; s.frame = 2; off.update(s);
    expect(off.shakeX).toBe(0);
  });
  test("the same frame's events add trauma once (rollback replay safe)", () => {
    const cam = new Camera(), s = fresh();
    s.frame = 7; s.events = [hit(0, 7)];
    cam.update(s); const t = cam.trauma;
    cam.update(s);
    expect(cam.trauma).toBeLessThan(t); // only decayed, not re-added
  });
  test("strength 2 gives a punch zoom", () => {
    const cam = new Camera(), s = fresh();
    s.frame = 1; s.events = [hit(2, 1)]; cam.update(s);
    expect(cam.zoom).toBeGreaterThan(1);
    expect(cam.zoom).toBeLessThanOrEqual(1.04 + 1e-9);
  });
});

describe("FX trails", () => {
  test("ring buffer keeps at most 6 points", () => {
    const t = new Trails();
    for (let i = 0; i < 50; i++) t.push(0, i, i);
    expect(t.count(0)).toBe(TRAIL_POINTS);
    expect(t.count(1)).toBe(0);
    t.decay(0); expect(t.count(0)).toBe(TRAIL_POINTS - 1);
    t.clear(0); expect(t.count(0)).toBe(0);
  });
});

describe("FX particles", () => {
  test("1000 events keep particles under the cap (256, or 128 with lowFx)", () => {
    for (const low of [false, true]) {
      const fx = new Fx(); fx.lowFx = low; const s = fresh();
      const kinds = ["hit", "block", "counter", "parry", "ko", "land", "special", "projectileClash"] as const;
      for (let i = 1; i <= 1000; i++) {
        s.frame = i; s.events = [{ ...hit((i % 3) as 0 | 1 | 2, i), kind: kinds[i % kinds.length]! }];
        fx.consume(s); fx.update();
        expect(fx.liveCount).toBeLessThanOrEqual(low ? POOL_SIZE >> 1 : POOL_SIZE);
      }
    }
  });
  test("the hit flash lasts 1-2 frames on the defender only", () => {
    const fx = new Fx(), s = fresh();
    s.frame = 3; s.events = [hit(2, 3)]; fx.consume(s);
    expect(fx.hitFlash).toEqual([0, 2]);
    fx.update(); fx.update();
    expect(fx.hitFlash).toEqual([0, 0]);
  });
  test("FX are not replayed for an already consumed frame", () => {
    const fx = new Fx(), s = fresh();
    s.frame = 9; s.events = [hit(1, 9)]; fx.consume(s);
    const n = fx.liveCount; fx.consume(s);
    expect(fx.liveCount).toBe(n);
  });
});

describe("FX combo and audio", () => {
  test("combo pop shrinks 1.4 -> 1 and colour heats at 3 and 6", () => {
    expect(popScale(POP_FRAMES)).toBeCloseTo(1.4);
    expect(popScale(0)).toBe(1);
    expect([comboColor(2), comboColor(3), comboColor(6)]).toEqual(["#ffffff", "#ffd84a", "#ff4a3a"]);
  });
  test("pitch rises 5 % per combo hit, capped at +30 %", () => {
    expect(comboRate(1)).toBe(1);
    expect(comboRate(3)).toBeCloseTo(1.1);
    expect(comboRate(20)).toBeCloseTo(1.3);
  });
  test("strength 2 hits add a thump layer, lighter hits do not", () => {
    const prev = fresh(), cur = cloneState(prev);
    cur.events = [hit(2, 1)];
    expect(cuesForFrame(prev, cur).map((c) => c.kind)).toEqual(["hitH", "thump"]);
    cur.events = [hit(0, 1)];
    expect(cuesForFrame(prev, cur).map((c) => c.kind)).toEqual(["hitL"]);
  });
});
