import { describe, expect, it } from "vitest";
import { BASE_IDS, CHARS, getMove, type CharId, type MoveDef } from "../../packages/shared/src/index.js";

const ROSTER: Record<CharId, { command: string; specials: string[]; super: string }> = {
  bolt: { command: "6HP", specials: ["rivetShot", "jackhammerRise", "hardHatHop"], super: "demolitionDrive" },
  volt: { command: "3LK", specials: ["staticSpark", "coilWhip", "liveWireHop"], super: "overload" },
  chompa: { command: "6HK", specials: ["gulpGrab", "eggLob", "tailSpin"], super: "stampedeRoll" },
  kaze: { command: "6LK", specials: ["shurikenFan", "smokeStep", "risingCrane"], super: "thousandShadows" },
  bao: { command: "3HP", specials: ["jadePalm", "rollingBun", "bambooCounter"], super: "dragonDumpling" },
};
const ids = Object.keys(CHARS) as CharId[];
const mv = (c: CharId, id: string): MoveDef => { const m = getMove(c, id); if (!m) throw new Error(`${c} ${id} missing`); return m; };
/** blockstun − (remaining active − 1 + recovery [+ landingRecovery]) when blocked on the first active frame. */
const onBlock = (m: MoveDef, withLr = false) => (m.hits[0]?.blockstun ?? 0) - (m.active - 1 + m.recovery + (withLr ? m.landingRecovery : 0));
const superDamage = (m: MoveDef): number => {
  if (m.lockOnHit) return m.lockOnHit.hits * m.lockOnHit.damage + m.lockOnHit.finalDamage;
  if (m.id === "stampedeRoll") return 6 * (m.hits[0]?.damage ?? 0);
  if (m.id === "overload") return 5 * (m.projectile?.damage ?? 0);
  if (m.projectile) return m.projectile.hits * m.projectile.damage;
  return m.hits.reduce((s, h) => s + h.damage, 0);
};

describe("character roster data", () => {
  it("has 5 characters", () => { expect(ids.sort()).toEqual(["bao", "bolt", "chompa", "kaze", "volt"]); });

  for (const c of ids) {
    describe(c, () => {
      const ch = CHARS[c];
      it("has 13 base ids, command normal, 3 specials with L/H variants and a super", () => {
        for (const id of BASE_IDS) expect(getMove(c, id), id).toBeDefined();
        expect(mv(c, ROSTER[c].command).kind).toBe("command");
        for (const s of ROSTER[c].specials) for (const v of [".L", ".H"]) expect(mv(c, s + v).kind).toBe("special");
        expect(mv(c, ROSTER[c].super).kind).toBe("super");
        expect(ch.moves.filter((m) => m.kind === "super")).toHaveLength(1);
      });
      it("has unique move ids", () => { expect(new Set(ch.moves.map((m) => m.id)).size).toBe(ch.moves.length); });
      it("keeps every hit inside the active window", () => {
        for (const m of ch.moves) for (const h of m.hits) {
          expect(h.frames[0], m.id).toBeGreaterThanOrEqual(m.startup + 1);
          expect(h.frames[1], m.id).toBeLessThanOrEqual(m.startup + m.active);
          expect(h.frames[0], m.id).toBeLessThanOrEqual(h.frames[1]);
        }
      });
      it("uses integers only", () => {
        const walk = (v: unknown): void => {
          if (typeof v === "number") expect(Number.isInteger(v)).toBe(true);
          else if (v && typeof v === "object") Object.values(v).forEach(walk);
        };
        walk(ch);
      });
      it("guardrail 1: 5LP +1..+3, 5HP/5HK/2HK −3..−12 on block", () => {
        const lp = onBlock(mv(c, "5LP"));
        expect(lp).toBeGreaterThanOrEqual(1); expect(lp).toBeLessThanOrEqual(3);
        for (const id of ["5HP", "5HK", "2HK"]) {
          const a = onBlock(mv(c, id));
          expect(a, id).toBeLessThanOrEqual(-3); expect(a, id).toBeGreaterThanOrEqual(-12);
        }
      });
      it("guardrail 3: projectile specials total ≥ 38 frames", () => {
        for (const m of ch.moves) if (m.kind === "special" && m.projectile) expect(m.startup + m.active + m.recovery, m.id).toBeGreaterThanOrEqual(38);
      });
      it("guardrail 4: super unscaled damage 250–360", () => {
        const d = superDamage(mv(c, ROSTER[c].super));
        expect(d).toBeGreaterThanOrEqual(250); expect(d).toBeLessThanOrEqual(360);
      });
      it("guardrail 5: normals startup ≥ 3; active ≤ 30 except stampedeRoll and counters", () => {
        for (const m of ch.moves) {
          if (m.kind === "normal" || m.kind === "command") expect(m.startup, m.id).toBeGreaterThanOrEqual(3);
          if (m.kind !== "throw" && m.id !== "stampedeRoll" && !m.counter) expect(m.active, m.id).toBeLessThanOrEqual(30);
        }
      });
    });
  }

  it("guardrail 2: DP specials ≤ −20 on block (incl. landing recovery)", () => {
    for (const [c, id] of [["bolt", "jackhammerRise"], ["volt", "liveWireHop"], ["kaze", "risingCrane"]] as const)
      for (const v of [".L", ".H"]) expect(onBlock(mv(c, id + v), true), id + v).toBeLessThanOrEqual(-20);
  });

  it("spot-checks characters.md values", () => {
    expect(superDamage(mv("bolt", "demolitionDrive"))).toBe(330);
    expect(superDamage(mv("kaze", "thousandShadows"))).toBe(340);
    expect(mv("volt", "5HK").hits[0]?.box.w).toBe(72);
    expect(mv("kaze", "5LP").hits[0]?.damage).toBe(25);
    expect(mv("kaze", "5LP").startup).toBe(3);
    expect(mv("chompa", "gulpGrab.H").grab?.range).toBe(6500);
    expect(mv("bao", "bambooCounter.L").counter).toEqual({ from: 4, to: 21, damage: 130 });
    expect(CHARS.kaze.airJumpMax).toBe(1);
    expect(CHARS.bolt.airJumpMax).toBe(0);
    expect(mv("volt", "j.HK").gravityScale).toBe(50);
  });
});
