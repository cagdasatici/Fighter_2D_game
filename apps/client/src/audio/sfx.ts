import type { FxEvent, MatchState } from '@kb/shared';
import { PRIORITY_IMPACT, PRIORITY_MAJOR, PRIORITY_OTHER, type Priority, type SoundKind } from './synth.js';

/** One sound cue for a simulated frame. Presentation only; never mutates state. */
export interface Cue { kind: SoundKind; priority: Priority; /** Playback pitch multiplier (combo escalation). Absent = 1. */ rate?: number }

/** +5 % pitch per combo hit beyond the first, capped at +30 %. */
export function comboRate(hits: number): number { return 1 + Math.min(0.3, 0.05 * Math.max(0, hits - 1)); }

const HIT_BY_STRENGTH: readonly SoundKind[] = ['hitL', 'hitM', 'hitH'];

/** Projectile kind (chars data) -> spec §13 recipe. lightningColumn (Overload super) reuses spark (decision 0006). */
export const PROJECTILE_SOUND: Record<string, SoundKind> = {
  rivet: 'projRivet', spark: 'projSpark', lightningColumn: 'projSpark', egg: 'projEgg',
  shuriken: 'projShuriken', jadeDragon: 'projJade',
};

export function cueForEvent(e: FxEvent): Cue | null {
  switch (e.kind) {
    case 'hit': case 'counter': case 'throw': return { kind: HIT_BY_STRENGTH[e.strength]!, priority: PRIORITY_IMPACT };
    case 'block': case 'parry': return { kind: 'block', priority: PRIORITY_MAJOR };
    case 'projectileClash': return { kind: 'hitM', priority: PRIORITY_MAJOR };
    case 'super': return { kind: 'super', priority: PRIORITY_IMPACT };
    case 'ko': return { kind: 'ko', priority: PRIORITY_IMPACT };
    case 'whiff': return { kind: 'whiff', priority: PRIORITY_OTHER };
    case 'land': return { kind: 'land', priority: PRIORITY_OTHER };
    case 'special': return null; // projectile/special audio comes from the spawned projectile below
  }
}

/**
 * Cues for the frame `prev -> cur`: every `cur.events` entry, plus cues the sim does not emit as events
 * (jump take-off, landing, attack start as a whiff swing, new projectiles), derived by comparing the two states.
 */
export function cuesForFrame(prev: MatchState, cur: MatchState): Cue[] {
  const out: Cue[] = [];
  const evKinds = new Set(cur.events.map((e) => e.kind));
  for (const e of cur.events) {
    const c = cueForEvent(e);
    if (!c) continue;
    if (e.kind === 'hit' || e.kind === 'counter' || e.kind === 'throw') {
      const rate = comboRate(cur.fighters[e.by === 0 ? 1 : 0].comboHits);
      if (rate !== 1) c.rate = rate;
      out.push(c);
      if (e.strength === 2) out.push({ kind: 'thump', priority: PRIORITY_IMPACT, ...(rate !== 1 ? { rate } : {}) });
    } else out.push(c);
  }
  for (const i of [0, 1] as const) {
    const a = prev.fighters[i], b = cur.fighters[i];
    if (a.state === b.state) continue;
    if (a.state === 'jumpSquat' && b.state === 'air') out.push({ kind: 'jump', priority: PRIORITY_OTHER });
    else if (b.state === 'land' && !evKinds.has('land')) out.push({ kind: 'land', priority: PRIORITY_OTHER });
    else if (b.state === 'attack' && !evKinds.has('whiff')) out.push({ kind: 'whiff', priority: PRIORITY_OTHER });
  }
  const before = new Map<string, number>();
  for (const p of prev.projectiles) before.set(`${p.owner}:${p.kind}`, (before.get(`${p.owner}:${p.kind}`) ?? 0) + 1);
  for (const p of cur.projectiles) {
    const k = `${p.owner}:${p.kind}`, n = before.get(k) ?? 0;
    if (n > 0) { before.set(k, n - 1); continue; }
    const kind = PROJECTILE_SOUND[p.kind];
    if (kind) out.push({ kind, priority: PRIORITY_MAJOR });
  }
  return out;
}
