import { describe, expect, it } from "vitest";
import type { CharId } from "../../packages/shared/src/chars/types.js";
import { PX } from "../../packages/shared/src/fixed.js";
import { DOWN, HK, HP, LP, RIGHT } from "../../packages/shared/src/input/buttons.js";
import { SUPER_COST, SUPER_FREEZE_FRAMES } from "../../packages/shared/src/sim/constants.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { at } from "../helpers/fight.js";
import { hold, runFrames, type Frame } from "../helpers/run.js";
import { begin } from "../helpers/special.js";

const p1 = (s: MatchState) => s.fighters[0];
const p2 = (s: MatchState) => s.fighters[1];
/** P1 facing right: 2,3,6,2,3,6+btn. */
const dqcf = (btn: number): Frame[] => [[DOWN, 0], [DOWN | RIGHT, 0], [RIGHT, 0], [DOWN, 0], [DOWN | RIGHT, 0], [RIGHT | btn, 0]];
const SUPER: Record<CharId, { id: string; btn: number; total: number }> = {
  bolt: { id: "demolitionDrive", btn: LP, total: 330 },
  volt: { id: "overload", btn: LP, total: 350 },
  chompa: { id: "stampedeRoll", btn: HK, total: 330 },
  kaze: { id: "thousandShadows", btn: LP, total: 340 },
  bao: { id: "dragonDumpling", btn: LP, total: 250 },
};
/** Fight-phase match where P1 has a full meter. */
function ready(gap: number, c: CharId): MatchState {
  const s = at(gap, c);
  p1(s).meter = SUPER_COST;
  return s;
}

describe("S7 supers: input gate, meter cost, freeze", () => {
  it("QCF QCF + P starts the super with full meter and costs SUPER_COST", () => {
    const s = ready(300, "bolt");
    runFrames(s, dqcf(LP));
    expect(p1(s).move).toBe("demolitionDrive");
    expect(p1(s).meter).toBe(0);
    expect(s.superFreeze).toBe(SUPER_FREEZE_FRAMES);
    expect(s.superBy).toBe(0);
    expect(s.events.some((e) => e.kind === "super" && e.by === 0)).toBe(true);
  });
  it("without full meter the super is refused (the motion falls through to a special/normal)", () => {
    const s = ready(300, "bolt");
    p1(s).meter = SUPER_COST - 1;
    runFrames(s, dqcf(LP));
    expect(p1(s).move).not.toBe("demolitionDrive");
    expect(s.superFreeze).toBe(0);
  });
  it("freezes both fighters, projectiles and the timer for exactly 40 frames", () => {
    const s = ready(300, "bolt");
    s.projectiles.push({ owner: 1, kind: "rivet", x: 0, y: 70 * PX, vx: -650, vy: 0, gravity: 0, w: 20, h: 10, hits: 1, hitInterval: 0, cooldown: 0, life: 50, def: "bolt:rivetShot.H", exploding: 0 });
    runFrames(s, dqcf(LP));
    const snap = JSON.stringify({ f: s.fighters.map((f) => [f.x, f.y, f.state, f.stateFrame, f.moveFrame]), p: s.projectiles, t: s.timer });
    runFrames(s, hold(0, RIGHT, SUPER_FREEZE_FRAMES)); // P2 holding forward does not walk during the freeze
    expect(JSON.stringify({ f: s.fighters.map((f) => [f.x, f.y, f.state, f.stateFrame, f.moveFrame]), p: s.projectiles, t: s.timer })).toBe(snap);
    expect(s.superFreeze).toBe(0);
    runFrames(s, hold(0, 0, 1));
    expect(p1(s).moveFrame).toBe(2);
    expect(s.projectiles[0]!.x).toBe(JSON.parse(snap).p[0].x - 650);
  });
  it("5LP on hit cancels into the super", () => {
    const s = ready(60, "bolt");
    runFrames(s, [[LP, 0], ...hold(0, 0, 4)]);
    expect(p1(s).move).toBe("5LP");
    expect(p2(s).state).toBe("hitstun");
    // Motion during hitstop; the buffered press starts the super when hitstop ends.
    runFrames(s, [...dqcf(HP), ...hold(0, 0, 4)]);
    expect(p1(s).move).toBe("demolitionDrive");
  });
});

describe("S7 super damage = characters.md total, fresh combo, unscaled (±1)", () => {
  for (const c of ["bolt", "chompa", "kaze", "bao"] as const) {
    it(`${c} ${SUPER[c].id} deals ${SUPER[c].total}`, () => {
      const s = ready(c === "chompa" ? 120 : 150, c);
      runFrames(s, [...dqcf(SUPER[c].btn), ...hold(0, 0, 220)]);
      expect(Math.abs(1000 - p2(s).hp - SUPER[c].total)).toBeLessThanOrEqual(1);
    });
  }
  it("volt overload: 5 columns × 70 = 350 (each column checked on a dummy at its x; columns are 100 px apart)", () => {
    let total = 0;
    for (const px of [80, 180, 280, 380, 480]) {
      const s = ready(px, "volt");
      runFrames(s, [...dqcf(LP), ...hold(0, 0, 100)]);
      total += 1000 - p2(s).hp;
    }
    expect(total).toBe(SUPER[`volt`].total);
  });
});

describe("S7 super combo scaling (decision 0003)", () => {
  it("a super started at combo hit index 3 uses 70% for every hit (demolitionDrive 4×35 + 91 = 231)", () => {
    const s = at(150, "bolt");
    Object.assign(p2(s), { state: "hitstun", stun: 60, comboHits: 3 });
    begin(s, 0, "demolitionDrive");
    runFrames(s, hold(0, 0, 80));
    expect(1000 - p2(s).hp).toBe(4 * 35 + 91);
  });
  it("multi-hit projectile super: jadeDragon at combo index 3 is 5×35 = 175", () => {
    const s = at(150, "bao");
    Object.assign(p2(s), { state: "hitstun", stun: 200, comboHits: 3 });
    begin(s, 0, "dragonDumpling");
    runFrames(s, hold(0, 0, 150));
    expect(1000 - p2(s).hp).toBe(5 * 35);
  });
  it("normal moves still scale per hit", () => {
    const s = at(60, "bolt");
    Object.assign(p2(s), { state: "hitstun", stun: 60, comboHits: 3 });
    runFrames(s, [[LP, 0], ...hold(0, 0, 10)]);
    expect(1000 - p2(s).hp).toBe(21); // 30 × 70%
  });
});

describe("decision 0003: multi-hit projectiles freeze during the hitstop they cause", () => {
  it("staticSpark (2 hits) keeps x, life and cooldown while the defender is in its hitstop, then resumes", () => {
    const s = at(200, "volt");
    s.projectiles.push({ owner: 0, kind: "spark", x: p2(s).x - 1500, y: 70 * PX, vx: 250, vy: 0, gravity: 0, w: 26, h: 26, hits: 2, hitInterval: 10, cooldown: 0, life: 100, def: "volt:staticSpark.L", exploding: 0 });
    let n = 0;
    while (p2(s).hitstop === 0 && n++ < 30) runFrames(s, hold(0, 0, 1));
    const p = s.projectiles[0]!, snap = [p.x, p.life, p.cooldown], stop = p2(s).hitstop;
    runFrames(s, hold(0, 0, stop));
    expect([p.x, p.life, p.cooldown]).toEqual(snap);
    runFrames(s, hold(0, 0, 1));
    expect([p.x, p.life, p.cooldown]).toEqual([snap[0]! + 250, snap[1]! - 1, snap[2]! - 1]);
  });
});
