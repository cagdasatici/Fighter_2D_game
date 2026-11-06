import { describe, expect, it } from "vitest";
import { DOWN, HK, HP, LEFT, LK, LP, RIGHT } from "../../packages/shared/src/input/buttons.js";
import { PX } from "../../packages/shared/src/fixed.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { at } from "../helpers/fight.js";
import { hold, runFrames } from "../helpers/run.js";
import { advantage, begin, dd, dp, qcb, qcf } from "../helpers/special.js";

const p1 = (s: MatchState) => s.fighters[0];
const p2 = (s: MatchState) => s.fighters[1];
void [DOWN, HK, HP, LEFT, LK, LP, RIGHT, PX, advantage, begin, dd, dp, qcb, qcf];

describe("S6 Bao specials", () => {
  const counterVs = (variant: "L" | "H", normal: number) => {
    const s = at(60, "bao");
    begin(s, 0, `bambooCounter.${variant}`);
    runFrames(s, [[0, normal], ...hold(0, 0, 12)]);
    return s;
  };
  it("bambooCounter.L (high) parries 5HP: attacker takes 130, launched, parry event", () => {
    const s = counterVs("L", HP);
    expect(p2(s).hp).toBe(1000 - 130);
    expect(p1(s).hp).toBe(1100);
  });
  it("bambooCounter.L does not parry 2LK (low)", () => {
    const s = counterVs("L", DOWN | LK);
    expect(p2(s).hp).toBe(1000);
    expect(p1(s).hp).toBeLessThan(1100);
  });
  it("bambooCounter.H (low) parries 2LK", () => {
    const s = counterVs("H", DOWN | LK);
    expect(p2(s).hp).toBe(1000 - 130);
  });
  it("bambooCounter parries a projectile (counts as mid): projectile destroyed, owner unharmed", () => {
    const s = at(200, "bao");
    begin(s, 0, "bambooCounter.L");
    s.projectiles.push({ owner: 1, kind: "rivet", x: p1(s).x + 8000, y: 70 * PX, vx: -650, vy: 0, gravity: 0, w: 20, h: 10, hits: 1, hitInterval: 0, cooldown: 0, life: 50, def: "bolt:rivetShot.H", exploding: 0 });
    let parry = false;
    for (let n = 0; n < 15; n++) { runFrames(s, [[0, 0]]); parry ||= s.events.some((e) => e.kind === "parry"); }
    expect(parry).toBe(true);
    expect(s.projectiles.length).toBe(0);
    expect([p1(s).hp, p2(s).hp]).toEqual([1100, 1000]);
  });
  it("jadePalm.H: 130 and knockdown; .L on block = 16 − (3 + 24) = −11", () => {
    const s = at(100, "bao");
    runFrames(s, [...qcf(HP), ...hold(0, 0, 20)]);
    expect(p2(s).hp).toBe(870);
    expect(p2(s).state).toBe("juggle");
    const b = at(80, "bao");
    runFrames(b, qcf(LP));
    let n = 0;
    while (p2(b).state !== "blockstun" && n++ < 20) runFrames(b, [[0, RIGHT]]);
    expect(advantage(b, RIGHT)).toBe(-11);
  });
  it("dragonDumpling heals 80 on f10 (capped at max) and fires jadeDragon on f30", () => {
    const s = at(500, "bao");
    p1(s).hp = 1000;
    begin(s, 0, "dragonDumpling");
    runFrames(s, hold(0, 0, 8));
    expect(p1(s).hp).toBe(1000);
    runFrames(s, hold(0, 0, 1));
    expect(p1(s).hp).toBe(1080);
    runFrames(s, hold(0, 0, 20));
    expect(s.projectiles[0]?.kind).toBe("jadeDragon");
    const c = at(500, "bao");
    p1(c).hp = 1090;
    begin(c, 0, "dragonDumpling");
    runFrames(c, hold(0, 0, 10));
    expect(p1(c).hp).toBe(1100);
  });
  it("jadeDragon freezes during its hitstop (decision 0003): all 5 hits connect, hitstop 11 + interval 4 apart, 250 total", () => {
    const s = at(150, "bao");
    begin(s, 0, "dragonDumpling");
    const at_: number[] = [];
    for (let n = 0; n < 100; n++) { runFrames(s, [[0, 0]]); if (s.events.some((e) => e.kind === "hit")) at_.push(s.frame); }
    expect(at_.map((f) => f - at_[0]!)).toEqual([0, 15, 30, 45, 60]);
    expect(1000 - p2(s).hp).toBe(250); // fresh super: unscaled (decision 0003)
  });
  it("a knockdown projectile knocks down only on its last hit", () => {
    const s = at(200, "bao");
    const mk = (hits: number) => ({ owner: 0 as const, kind: "jadeDragon", x: p2(s).x, y: 60 * PX, vx: 0, vy: 0, gravity: 0, w: 90, h: 70, hits, hitInterval: 4, cooldown: 0, life: 50, def: "bao:dragonDumpling", exploding: 0 });
    s.projectiles.push(mk(2));
    runFrames(s, [[0, 0]]);
    expect(p2(s).state).toBe("hitstun");
    s.projectiles = [mk(1)];
    runFrames(s, [[0, 0]]);
    expect(p2(s).state).toBe("juggle");
  });
});
