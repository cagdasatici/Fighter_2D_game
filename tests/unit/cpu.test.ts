import { describe, expect, it } from "vitest";
import { createCpu, cpuInput, cpuSeed, type CpuDifficulty } from "../../packages/shared/src/ai/cpu.js";
import { HK } from "../../packages/shared/src/input/buttons.js";
import { ROUND_FRAMES } from "../../packages/shared/src/sim/constants.js";
import { createMatch } from "../../packages/shared/src/sim/state.js";
import { step } from "../../packages/shared/src/sim/step.js";
import type { CharId } from "../../packages/shared/src/chars/types.js";
import { at } from "../helpers/fight.js";

function cpuVsCpu(seed: number, chars: [CharId, CharId], d: [CpuDifficulty, CpuDifficulty], frames: number): number[] {
  const s = createMatch({ chars, stage: "rooftop", seed });
  const a = createCpu({ side: 0, difficulty: d[0], matchSeed: seed });
  const b = createCpu({ side: 1, difficulty: d[1], matchSeed: seed ^ 1 });
  const log: number[] = [];
  for (let i = 0; i < frames && s.phase !== "matchEnd"; i++) {
    const ia = cpuInput(a, s), ib = cpuInput(b, s);
    log.push(ia, ib);
    step(s, [ia, ib]);
  }
  return log;
}

describe("CPU (spec §11.6)", () => {
  it("seeds its own rng from match seed XOR 0x9e3779b9", () => {
    expect(cpuSeed(0)).toBe(0x9e3779b9);
    expect(createCpu({ side: 1, difficulty: "hard", matchSeed: 5 }).rng).toBe((5 ^ 0x9e3779b9) >>> 0);
  });

  it("is deterministic: same seed gives the same inputs over 3000 frames", () => {
    const x = cpuVsCpu(42, ["bolt", "kaze"], ["hard", "normal"], 3000);
    const y = cpuVsCpu(42, ["bolt", "kaze"], ["hard", "normal"], 3000);
    expect(x.length).toBe(6000);
    expect(x).toEqual(y);
    expect(x.some((v) => v !== 0)).toBe(true);
  });

  it("never touches the match rng", () => {
    const s = createMatch({ chars: ["volt", "bao"], stage: "rooftop", seed: 9 });
    const cpu = createCpu({ side: 1, difficulty: "hard", matchSeed: 9 });
    for (let i = 0; i < 600; i++) { const r = s.rng; cpuInput(cpu, s); expect(s.rng).toBe(r); step(s, [0, cpuInput(cpu, s)]); }
  });

  it("CPU vs CPU match ends with a winner within 3 x ROUND_FRAMES", () => {
    const pairs: [CharId, CharId][] = [["bolt", "volt"], ["chompa", "kaze"], ["bao", "bolt"]];
    for (const [i, chars] of pairs.entries()) {
      const s = createMatch({ chars, stage: "rooftop", seed: 100 + i });
      const a = createCpu({ side: 0, difficulty: "normal", matchSeed: 100 + i });
      const b = createCpu({ side: 1, difficulty: "hard", matchSeed: 200 + i });
      let n = 0;
      while (s.phase !== "matchEnd" && n < 3 * ROUND_FRAMES) { step(s, [cpuInput(a, s), cpuInput(b, s)]); n++; }
      expect(s.phase, `${chars.join(" vs ")}`).toBe("matchEnd");
      expect(s.winner === 0 || s.winner === 1).toBe(true);
    }
  });

  it("hard CPU blocks at least 70% of 5HK attempts", () => {
    const s = at(70, "bolt", "bolt");
    const cpu = createCpu({ side: 1, difficulty: "hard", matchSeed: 7 });
    let blocked = 0, hit = 0, prev = 0;
    for (let i = 0; i < 3000; i++) {
      const p1 = s.fighters[0];
      const free = p1.state === "idle" || p1.state === "walkF" || p1.state === "walkB" || p1.state === "crouch";
      if (free) { // scripted reset: same spacing and full hp before every attempt
        s.fighters[0].x = -3500; s.fighters[1].x = 3500; s.fighters[0].hp = 1000; s.fighters[1].hp = 1000;
      }
      const b0 = free && prev === 0 ? HK : 0;
      prev = b0;
      const was5HK = p1.state === "attack" && p1.move === "5HK";
      step(s, [b0, cpuInput(cpu, s)]);
      expect(s.phase).toBe("fight");
      if (!was5HK && !(s.fighters[0].state === "attack" && s.fighters[0].move === "5HK")) continue;
      for (const e of s.events) if (e.by === 0) { if (e.kind === "block") blocked++; else if (e.kind === "hit" || e.kind === "counter") hit++; }
    }
    const attempts = blocked + hit;
    expect(attempts).toBeGreaterThanOrEqual(20);
    expect(blocked * 100).toBeGreaterThanOrEqual(70 * attempts);
  });
});
