import { describe, expect, it } from "vitest";
import { CHARS } from "../../packages/shared/src/chars/index.js";
import { LP } from "../../packages/shared/src/input/buttons.js";
import {
  ROUND_END_FRAMES, ROUND_FRAMES, ROUND_INTRO_FRAMES, START_X,
} from "../../packages/shared/src/sim/constants.js";
import { createMatch } from "../../packages/shared/src/sim/state.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { at } from "../helpers/fight.js";
import { hold, runFrames } from "../helpers/run.js";

const p1 = (s: MatchState) => s.fighters[0];
const p2 = (s: MatchState) => s.fighters[1];
/** Put P2 one hit from death and land a 5LP (30 dmg). */
function koP2(s: MatchState): void {
  p2(s).hp = 10;
  runFrames(s, [[LP, 0], ...hold(0, 0, 6)]);
}
const finishRound = (s: MatchState) => runFrames(s, hold(0, 0, ROUND_END_FRAMES));

describe("S7 round flow (spec §10)", () => {
  it("intro lasts ROUND_INTRO_FRAMES and ignores inputs", () => {
    const s = createMatch({ chars: ["bolt", "bolt"], stage: "rooftop", seed: 1 });
    runFrames(s, hold(LP | 8, LP, ROUND_INTRO_FRAMES - 1));
    expect(s.phase).toBe("intro");
    expect(p1(s).state).toBe("idle");
    expect(p1(s).x).toBe(-START_X);
    runFrames(s, hold(0, 0, 1));
    expect(s.phase).toBe("fight");
  });
  it("round timer is 99 s (5940 frames) and ticks once per fight frame", () => {
    const s = at(300);
    expect(s.timer).toBe(ROUND_FRAMES);
    runFrames(s, hold(0, 0, 100));
    expect(s.timer).toBe(ROUND_FRAMES - 100);
  });
  it("timer does not tick while both fighters are in hitstop", () => {
    const s = at(60);
    runFrames(s, [[LP, 0], ...hold(0, 0, 3)]); // 5LP connects on frame 5
    const t = s.timer;
    runFrames(s, hold(0, 0, 1));
    expect(p1(s).hitstop).toBeGreaterThan(0);
    expect(s.timer).toBe(t);
  });
  it("time over: higher hp percentage wins the round", () => {
    const s = at(300, "bolt", "bao");
    p1(s).hp = 500; // 500 per-mille
    p2(s).hp = Math.trunc(CHARS.bao.hp * 6 / 10); // 600 per-mille, whatever Bao's max hp is
    s.timer = 1;
    runFrames(s, hold(0, 0, 1));
    expect(s.phase).toBe("roundEnd");
    finishRound(s);
    expect([p1(s).wins, p2(s).wins]).toEqual([0, 1]);
  });
  it("time over with equal percentage is a draw", () => {
    const s = at(300);
    p1(s).hp = 400; p2(s).hp = 400; s.timer = 1;
    runFrames(s, hold(0, 0, 1 + ROUND_END_FRAMES));
    expect([p1(s).wins, p2(s).wins, s.drawRounds, s.round, s.phase]).toEqual([0, 0, 1, 2, "intro"]);
  });
  it("KO: loser enters ko with a juggle trajectory, roundEnd, ko event, winner gets the win pose", () => {
    const s = at(60);
    koP2(s);
    expect(s.phase).toBe("roundEnd");
    expect(p2(s).state).toBe("ko");
    expect(p2(s).airborne).toBe(true);
    runFrames(s, hold(0, 0, 60));
    expect(p1(s).state).toBe("win");
    expect(p2(s).state).toBe("ko");
  });
  it("double KO is a draw", () => {
    const s = at(60);
    p1(s).hp = 10; p2(s).hp = 10;
    runFrames(s, [[LP, LP], ...hold(0, 0, 6)]); // 5LP trade
    expect(p1(s).state).toBe("ko");
    expect(p2(s).state).toBe("ko");
    finishRound(s);
    expect([p1(s).wins, p2(s).wins, s.drawRounds]).toEqual([0, 0, 1]);
  });
  it("best of 3: two round wins end the match; positions/hp/projectiles reset, meter carried", () => {
    const s = at(60);
    p1(s).meter = 300; p2(s).meter = 450;
    s.projectiles.push({ owner: 0, kind: "rivet", x: 0, y: 7000, vx: 0, vy: 0, gravity: 0, w: 20, h: 10, hits: 1, hitInterval: 0, cooldown: 0, life: 9999, def: "bolt:rivetShot.H", exploding: 0 });
    koP2(s);
    const meters = [p1(s).meter, p2(s).meter];
    finishRound(s);
    expect([s.phase, s.round, p1(s).wins, p2(s).wins]).toEqual(["intro", 2, 1, 0]);
    expect([p1(s).x, p2(s).x, p1(s).hp, p2(s).hp]).toEqual([-START_X, START_X, 1000, 1000]);
    expect([p1(s).meter, p2(s).meter]).toEqual(meters);
    expect(s.projectiles).toEqual([]);
    expect(s.timer).toBe(ROUND_FRAMES);
    runFrames(s, hold(0, 0, ROUND_INTRO_FRAMES));
    expect(s.phase).toBe("fight");
    p1(s).x = -3000; p2(s).x = 3000;
    koP2(s);
    finishRound(s);
    expect([s.phase, s.winner, p1(s).wins]).toEqual(["matchEnd", 0, 2]);
    runFrames(s, hold(LP, LP, 300));
    expect([s.phase, s.winner]).toEqual(["matchEnd", 0]); // holds forever
  });
  it("after 3 draws the next round is final; a draw there goes to remaining hp, equal → P1", () => {
    const s = at(300);
    s.drawRounds = 3; s.round = 4;
    p1(s).hp = 300; p2(s).hp = 300; s.timer = 1;
    runFrames(s, hold(0, 0, 1 + ROUND_END_FRAMES));
    expect([s.phase, s.winner]).toEqual(["matchEnd", 0]);
    const t = at(300);
    t.drawRounds = 3;
    p2(t).wins = 0; p1(t).hp = 200; p2(t).hp = 300; t.timer = 1;
    runFrames(t, hold(0, 0, 1 + ROUND_END_FRAMES));
    expect([t.phase, t.winner]).toEqual(["matchEnd", 1]); // a plain win in the final round ends the match
  });
});
