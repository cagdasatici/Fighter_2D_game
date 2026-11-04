import { describe, expect, it } from "vitest";
import { CHARS, getMove, type CharId, type MoveDef } from "../../packages/shared/src/index.js";
import { HK, HP, LK, LP } from "../../packages/shared/src/input/buttons.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { at } from "../helpers/fight.js";
import { hold, runFrames } from "../helpers/run.js";
import { dp } from "../helpers/special.js";

// characters.md §9 balance guardrails, asserted from data (S7).
const ids = Object.keys(CHARS) as CharId[];
const mv = (c: CharId, id: string): MoveDef => { const m = getMove(c, id); if (!m) throw new Error(`${c} ${id} missing`); return m; };
/** blockstun − (remaining active − 1 + recovery [+ landingRecovery]) when blocked on the first active frame. */
const onBlock = (m: MoveDef, withLr = false) => (m.hits[0]?.blockstun ?? 0) - (m.active - 1 + m.recovery + (withLr ? m.landingRecovery : 0));
/** Unscaled total of a super from its data. */
function superTotal(m: MoveDef): number {
  if (m.lockOnHit) return m.lockOnHit.hits * m.lockOnHit.damage + m.lockOnHit.finalDamage;
  if (m.id === "stampedeRoll") return 6 * (m.hits[0]?.damage ?? 0);  // max 6 contacts (characters.md)
  if (m.id === "overload") return 5 * (m.projectile?.damage ?? 0);   // 5 columns
  if (m.projectile) return m.projectile.hits * m.projectile.damage;
  return m.hits.reduce((s, h) => s + h.damage, 0);
}
const supers = (c: CharId) => CHARS[c].moves.filter((m) => m.kind === "super");

describe("balance guardrails (characters.md §9)", () => {
  it("rule 1: every 5LP is +1..+3 on block; 5HP/5HK/2HK are −3..−12", () => {
    for (const c of ids) {
      const lp = onBlock(mv(c, "5LP"));
      expect(lp, `${c} 5LP`).toBeGreaterThanOrEqual(1); expect(lp, `${c} 5LP`).toBeLessThanOrEqual(3);
      for (const id of ["5HP", "5HK", "2HK"]) {
        const a = onBlock(mv(c, id));
        expect(a, `${c} ${id}`).toBeLessThanOrEqual(-3); expect(a, `${c} ${id}`).toBeGreaterThanOrEqual(-12);
      }
    }
  });
  it("rule 2: DP specials are ≤ −20 on block (incl. landing recovery)", () => {
    for (const [c, id] of [["bolt", "jackhammerRise"], ["volt", "liveWireHop"], ["kaze", "risingCrane"]] as const)
      for (const v of [".L", ".H"]) expect(onBlock(mv(c, id + v), true), id + v).toBeLessThanOrEqual(-20);
  });
  it("rule 3: every projectile special has total frames ≥ 38", () => {
    for (const c of ids) for (const m of CHARS[c].moves)
      if (m.kind === "special" && m.projectile) expect(m.startup + m.active + m.recovery, m.id).toBeGreaterThanOrEqual(38);
  });
  it("rule 4: every super's unscaled total damage is 250–360", () => {
    for (const c of ids) {
      expect(supers(c)).toHaveLength(1);
      const d = superTotal(supers(c)[0]!);
      expect(d, c).toBeGreaterThanOrEqual(250); expect(d, c).toBeLessThanOrEqual(360);
    }
  });
  it("rule 5: no normal has startup < 3; no non-throw move has active > 30 except stampedeRoll and counter stances", () => {
    for (const c of ids) for (const m of CHARS[c].moves) {
      if (m.kind === "normal" || m.kind === "command") expect(m.startup, m.id).toBeGreaterThanOrEqual(3);
      if (m.kind !== "throw" && m.id !== "stampedeRoll" && !m.counter) expect(m.active, m.id).toBeLessThanOrEqual(30);
    }
  });
});

describe("rising specials: listed totals measured vs an airborne target (decision 0003)", () => {
  const air = (s: MatchState) => Object.assign(s.fighters[1], { airborne: true, state: "air", y: 4000, vy: 0 });
  const cases: [CharId, number, number][] = [
    ["bolt", LP, 110], ["bolt", HP, 140],    // jackhammerRise
    ["kaze", LK, 100], ["kaze", HK, 130],    // risingCrane
  ];
  // Decision 0004: same-move hits continue a juggle. Volt out-rises the target, so the 4th hit passes over it: 30+30+24 = 84.
  it("volt liveWireHop hits an airborne opponent 3 times for 84 scaled (decision 0004)", () => {
    for (const btn of [LK, HK]) {
      const s = at(40, "volt", "volt");
      air(s);
      runFrames(s, [...dp(btn), ...hold(0, 0, 40)]);
      expect(CHARS.volt.hp - s.fighters[1].hp).toBe(84);
    }
  });
  for (const [c, btn, total] of cases) {
    it(`${c} DP+${btn} deals ${total} to an airborne opponent`, () => {
      const s = at(40, c, c);
      air(s);
      runFrames(s, [...dp(btn), ...hold(0, 0, 40)]);
      expect(CHARS[c].hp - s.fighters[1].hp).toBe(total);
    });
  }
});
