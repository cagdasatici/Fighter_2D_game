import { idiv } from "../fixed.js";
import type { CharDef, CharId, MoveDef } from "./types.js";

/**
 * TUNE balance table (decision 0018). Percent multipliers applied once at load to the authored data,
 * each within +-10 % of the authored value. Supers are untouched (characters.md rule 4).
 * `dmg`: hit / projectile / grab / counter damage of non-super moves.
 * `recovery`: per move id, percent of the authored frames. Startup is not tuned: hit windows are absolute move frames.
 */
export interface CharTuning { dmg: number; recovery?: Readonly<Record<string, number>> }
export const TUNING: Readonly<Record<CharId, CharTuning>> = {
  bolt: { dmg: 90, recovery: { "5LK": 110, "2LK": 110, "5HP": 110, "5HK": 110, "2HK": 110, "2HP": 110, "rivetShot.H": 110, "rivetShot.L": 110, "jackhammerRise.H": 110 } },
  volt: { dmg: 100, recovery: { "5LP": 90, "2HP": 90 } },
  chompa: { dmg: 108 },
  kaze: { dmg: 110, recovery: { "5LK": 90, "2LK": 90, "5HK": 90, "6LK": 90, "2HK": 90 } },
  bao: { dmg: 102 },
};

const scale = (v: number, pct: number): number => idiv(v * pct + 50, 100);
const frames = (v: number, pct: number): number => Math.max(1, scale(v, pct));

function tuneMove(m: MoveDef, t: CharTuning): MoveDef {
  const rp = t.recovery?.[m.id];
  const recovery = rp === undefined ? m.recovery : frames(m.recovery, rp);
  if (m.kind === "super") return { ...m, recovery };
  return {
    ...m, recovery,
    hits: m.hits.map((h) => ({ ...h, damage: scale(h.damage, t.dmg) })),
    projectile: m.projectile ? { ...m.projectile, damage: scale(m.projectile.damage, t.dmg) } : null,
    grab: m.grab ? { ...m.grab, damage: scale(m.grab.damage, t.dmg) } : null,
    counter: m.counter ? { ...m.counter, damage: scale(m.counter.damage, t.dmg) } : null,
  };
}

export function tuned(def: CharDef): CharDef {
  const t = TUNING[def.id];
  return { ...def, moves: def.moves.map((m) => tuneMove(m, t)) };
}
