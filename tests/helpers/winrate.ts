import { createCpu, cpuInput } from "../../packages/shared/src/ai/cpu.js";
import type { CharId } from "../../packages/shared/src/chars/types.js";
import { createMatch } from "../../packages/shared/src/sim/state.js";
import { step } from "../../packages/shared/src/sim/step.js";

export const CHAR_IDS: CharId[] = ["bolt", "volt", "chompa", "kaze", "bao"];
const STAGES = ["rooftop", "bamboo", "volcano"] as const;

/** CPU-hard vs CPU-hard; returns winner side (0/1) or -1 for no winner. Fixed seeds; sides swap on odd i. */
export function playMatch(a: CharId, b: CharId, i: number): 0 | 1 | -1 {
  const seed = 1000 + i;
  const swap = i % 2 === 1;
  const chars: [CharId, CharId] = swap ? [b, a] : [a, b];
  const s = createMatch({ chars, stage: STAGES[i % 3]!, seed });
  const c0 = createCpu({ side: 0, difficulty: "hard", matchSeed: seed });
  const c1 = createCpu({ side: 1, difficulty: "hard", matchSeed: seed ^ 1 });
  for (let f = 0; f < 60 * 60 * 6 && s.phase !== "matchEnd"; f++) step(s, [cpuInput(c0, s), cpuInput(c1, s)]);
  const w = s.winner as number | null | undefined;
  if (w === 0 || w === 1) return (swap ? 1 - w : w) as 0 | 1; // 0 = char a
  return -1;
}

/** Win rate of `a` over `b` in percent (draws/timeouts count half). */
export function pairRate(a: CharId, b: CharId, n: number): { rate: number; wins: number; losses: number; draws: number } {
  let wins = 0, losses = 0, draws = 0;
  for (let i = 0; i < n; i++) { const r = playMatch(a, b, i); if (r === 0) wins++; else if (r === 1) losses++; else draws++; }
  return { rate: ((wins + draws / 2) * 100) / n, wins, losses, draws };
}
