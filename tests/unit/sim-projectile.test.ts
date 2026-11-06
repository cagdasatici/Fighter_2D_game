import { describe, expect, it } from "vitest";
import { HP, LP, RIGHT } from "../../packages/shared/src/input/buttons.js";
import { PX } from "../../packages/shared/src/fixed.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { at } from "../helpers/fight.js";
import { hold, runFrames } from "../helpers/run.js";
import { begin, qcb, qcf } from "../helpers/special.js";

const p1 = (s: MatchState) => s.fighters[0];
const p2 = (s: MatchState) => s.fighters[1];
const BACK2 = RIGHT;

describe("S6 projectiles", () => {
  it("rivetShot.L spawns on move frame 12 at offset (50,70) and travels 450/frame", () => {
    const s = at(400);
    runFrames(s, qcf(LP));
    expect(p1(s).move).toBe("rivetShot.L");
    runFrames(s, hold(0, 0, 10));
    expect(s.projectiles.length).toBe(0);
    runFrames(s, hold(0, 0, 1)); // move frame 12: spawned, then moved once
    expect(s.projectiles.length).toBe(1);
    const pr = s.projectiles[0]!;
    expect(pr.x).toBe(p1(s).x + 50 * PX + 450);
    expect(pr.y).toBe(70 * PX);
    expect(pr.def).toBe("bolt:rivetShot.L");
  });
  it("one projectile per player: a second rivetShot is refused while the first is alive", () => {
    const s = at(500);
    runFrames(s, [...qcf(LP), ...hold(0, 0, 45)]); // move over (42 frames), rivet still flying
    expect(s.projectiles.length).toBe(1);
    runFrames(s, qcf(LP));
    expect(p1(s).move).not.toBe("rivetShot.L");
  });
  it("clash: rivet (1 hit) vs spark (2 hits) → rivet gone, spark keeps 1 hit, event", () => {
    const s = at(500, "bolt", "volt");
    begin(s, 0, "rivetShot.H"); begin(s, 1, "staticSpark.H");
    let clash = false;
    for (let n = 0; n < 60 && !clash; n++) { runFrames(s, [[0, 0]]); clash = s.events.some((e) => e.kind === "projectileClash"); }
    expect(clash).toBe(true);
    expect(s.projectiles.length).toBe(1);
    expect(s.projectiles[0]!.kind).toBe("spark");
    expect(s.projectiles[0]!.hits).toBe(1);
  });
  it("egg explodes on ground contact: 80×60 box, 20 frames, y 0", () => {
    const s = at(500, "chompa");
    p2(s).x = 59000; // out of reach
    runFrames(s, qcb(LP));
    let n = 0;
    while (!(s.projectiles[0]?.exploding) && n++ < 120) runFrames(s, [[0, 0]]);
    const e = s.projectiles[0]!;
    expect(e.exploding).toBe(20);
    expect([e.y, e.w, e.h, e.vx]).toEqual([0, 80, 60, 0]);
    runFrames(s, hold(0, 0, 20));
    expect(s.projectiles.length).toBe(0);
  });
  it("spark hits twice with a 10-frame interval (60 + 60)", () => {
    const s = at(200, "volt");
    runFrames(s, qcf(HP));
    const hitFrames: number[] = [];
    for (let n = 0; n < 80; n++) {
      runFrames(s, [[0, 0]]);
      if (s.events.some((e) => e.kind === "hit")) hitFrames.push(s.frame);
    }
    expect(hitFrames.length).toBe(2);
    expect(p2(s).hp).toBe(1000 - 120);
    expect(hitFrames[1]! - hitFrames[0]!).toBeGreaterThanOrEqual(10);
  });
  it("blocked projectile: chip 10, blockstun 14, only the defender gets hitstop", () => {
    const s = at(200);
    runFrames(s, qcf(HP));
    let n = 0;
    while (p2(s).state !== "blockstun" && n++ < 60) runFrames(s, [[0, BACK2]]);
    expect(p2(s).hp).toBe(990);
    expect(p2(s).stun).toBe(14);
    expect(p2(s).hitstop).toBe(8);
    expect(p1(s).hitstop).toBe(0);
  });
  it("projectiles are removed when lifetime ends or 100 px off stage", () => {
    const s = at(200);
    s.projectiles.push({ owner: 0, kind: "rivet", x: 60000 + 9900, y: 70 * PX, vx: 200, vy: 0, gravity: 0, w: 20, h: 10, hits: 1, hitInterval: 0, cooldown: 0, life: 50, def: "bolt:rivetShot.H", exploding: 0 });
    s.projectiles.push({ owner: 1, kind: "rivet", x: 0, y: 300 * PX, vx: 0, vy: 0, gravity: 0, w: 20, h: 10, hits: 1, hitInterval: 0, cooldown: 0, life: 2, def: "bolt:rivetShot.H", exploding: 0 });
    runFrames(s, [[0, 0]]);
    expect(s.projectiles.length).toBe(1);
    runFrames(s, [[0, 0]]);
    expect(s.projectiles.length).toBe(0);
  });
});
