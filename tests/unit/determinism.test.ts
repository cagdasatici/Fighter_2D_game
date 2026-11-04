import { describe, expect, it } from "vitest";
import type { CharId } from "../../packages/shared/src/chars/types.js";
import { nextRng } from "../../packages/shared/src/rng.js";
import { checksum } from "../../packages/shared/src/sim/checksum.js";
import { createMatch, cloneState } from "../../packages/shared/src/sim/state.js";
import { step } from "../../packages/shared/src/sim/step.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";

// Spec §16 determinism (a)(b)(c). Inputs come from a seeded xorshift32 generator (no Math.random).
const FRAMES = 20_000;
const SAVE_AT = 5_000;
const RESIM = 300;

/**
 * Seeded input stream. Mostly random bytes held 1-8 frames; sometimes a canned sequence (double quarter-circle + P,
 * or holding back/down-back) so supers and blocks actually happen. Directions are absolute (L/R), so they mean
 * forward or back depending on facing; both occur.
 */
const D = 2, L = 4, R = 8, LP = 16;
const CANNED: number[][] = [
  [D, D | R, R, D, D | R, R | LP],          // QCF QCF + P (facing right)
  [D, D | L, L, D, D | L, L | LP],          // same, facing left
  Array.from({ length: 24 }, () => L),      // hold left
  Array.from({ length: 24 }, () => R),      // hold right
  Array.from({ length: 24 }, () => D | L),  // crouch left
  Array.from({ length: 24 }, () => D | R),  // crouch right
];
function inputStream(seed: number, n: number): [number, number][] {
  let r = seed >>> 0 || 1;
  const next = (): number => (r = nextRng(r));
  const out: [number, number][] = [];
  const cur: [number, number] = [0, 0], left: [number, number] = [0, 0];
  const queue: [number[], number[]] = [[], []];
  for (let i = 0; i < n; i++) {
    for (const p of [0, 1] as const) {
      const q = queue[p];
      if (q.length > 0) { cur[p] = q.shift()!; left[p] = 0; continue; }
      if (left[p] === 0) {
        if (next() % 6 === 0) { q.push(...CANNED[next() % CANNED.length]!); cur[p] = q.shift()!; continue; }
        cur[p] = next() & 255; left[p] = 1 + (next() % 8);
      }
      left[p]--;
    }
    out.push([cur[0], cur[1]]);
  }
  return out;
}

const PAIRS: [CharId, CharId][] = [["bolt", "volt"], ["chompa", "kaze"], ["bao", "bolt"]];

/** New match (meter full so supers occur) restarted whenever a match ends, so all 20k frames are live play. */
function fresh(chars: [CharId, CharId], seed: number): MatchState {
  const s = createMatch({ chars, stage: "rooftop", seed });
  s.fighters[0].meter = 1000; s.fighters[1].meter = 1000;
  return s;
}
function run(chars: [CharId, CharId], seed: number, inputs: [number, number][]): { sums: number[]; s: MatchState } {
  let s = fresh(chars, seed);
  const sums: number[] = [];
  for (let i = 0; i < inputs.length; i++) {
    step(s, inputs[i]!);
    if (s.phase === "matchEnd" && s.phaseFrame > 60) s = fresh(chars, seed + i);
    if (i % 100 === 99) sums.push(checksum(s));
  }
  return { sums, s };
}

describe("determinism (spec §16)", () => {
  for (const chars of PAIRS) {
    const seed = 0x5eed + chars[0].length * 31 + chars[1].length;
    const inputs = inputStream(seed, FRAMES);

    it(`(a) ${chars.join(" vs ")}: 20,000 random frames run twice give equal checksums`, () => {
      const r1 = run(chars, seed, inputs), r2 = run(chars, seed, inputs);
      expect(r1.sums).toHaveLength(FRAMES / 100);
      expect(r2.sums).toEqual(r1.sums);
      expect(checksum(r2.s)).toBe(checksum(r1.s));
    });

    it(`(b) ${chars.join(" vs ")}: save at 5000, run 300, restore, re-run → equal`, () => {
      const s = fresh(chars, seed);
      for (let i = 0; i < SAVE_AT; i++) step(s, inputs[i]!);
      const saved = cloneState(s);
      const ahead: number[] = [];
      for (let i = SAVE_AT; i < SAVE_AT + RESIM; i++) { step(s, inputs[i]!); ahead.push(checksum(s)); }
      const r = cloneState(saved);
      const again: number[] = [];
      for (let i = SAVE_AT; i < SAVE_AT + RESIM; i++) { step(r, inputs[i]!); again.push(checksum(r)); }
      expect(again).toEqual(ahead);
      expect(checksum(saved)).not.toBe(ahead[ahead.length - 1]); // the 300 frames did change state
    });

    it(`(c) ${chars.join(" vs ")}: structuredClone round-trip equals JSON round-trip`, () => {
      const s = fresh(chars, seed);
      for (let i = 0; i < FRAMES; i++) {
        step(s, inputs[i]!);
        if (i % 2_000 === 1_999) {
          const sc = structuredClone(s), js = JSON.parse(JSON.stringify(s)) as MatchState;
          expect(sc).toStrictEqual(js);
          expect(checksum(sc)).toBe(checksum(js));
          expect(checksum(sc)).toBe(checksum(s));
        }
      }
    });
  }

  it("the random stream exercises the sim (hits, supers and round ends occur)", () => {
    const inputs = inputStream(0x5eed, FRAMES);
    let s = fresh(["bolt", "volt"], 1);
    const seen = new Set<string>();
    for (let i = 0; i < FRAMES; i++) {
      step(s, inputs[i]!);
      for (const e of s.events) seen.add(e.kind);
      if (s.phase !== "fight" && s.phase !== "intro") seen.add(s.phase);
      if (s.phase === "matchEnd" && s.phaseFrame > 60) s = fresh(["bolt", "volt"], i);
    }
    expect([...seen]).toEqual(expect.arrayContaining(["hit", "block", "super", "roundEnd"]));
  });
});
