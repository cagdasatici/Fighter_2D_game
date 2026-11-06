import { METER_MAX, THROW_RANGE, type MatchState } from '@kb/shared';

/** HELP1 in-match hints. Pure state machine fed once per sim frame; render only reads `current`. */
export type HintKind = 'special' | 'super' | 'throw';
export const HINT_FRAMES = 120; // ~2 s at 60 Hz
export const HINT_FADE = 20;
export function hintText(kind: HintKind, suKey: string): string {
  return kind === 'super' ? `SUPER ready: press ${suKey}` : kind === 'throw' ? 'Close! LP+LK = throw' : 'SP + direction = special';
}

/** Which hints newly trigger this frame for fighter `side`, given what was already shown. */
export function hintTriggers(s: MatchState, side: 0 | 1, seen: ReadonlySet<HintKind>): HintKind[] {
  const out: HintKind[] = [];
  if (s.phase !== 'fight') return out;
  const f = s.fighters[side], o = s.fighters[side === 0 ? 1 : 0];
  if (!seen.has('special') && s.round === 1) out.push('special');
  if (!seen.has('super') && f.meter >= METER_MAX) out.push('super');
  const dx = o.x - f.x;
  if (!seen.has('throw') && !f.airborne && !o.airborne && (dx < 0 ? -dx : dx) <= THROW_RANGE) out.push('throw');
  return out;
}

export class HintTracker {
  private seen = new Set<HintKind>();
  private queue: HintKind[] = [];
  private kind: HintKind | null = null;
  private left = 0;
  /** New match: every hint may show again. */
  reset(): void { this.seen.clear(); this.queue = []; this.kind = null; this.left = 0; }
  /** Call once per advanced sim frame (so pausing freezes the timer). Simultaneous hints queue one after another. */
  update(s: MatchState, side: 0 | 1): void {
    for (const k of hintTriggers(s, side, this.seen)) { this.seen.add(k); this.queue.push(k); }
    if (this.kind && --this.left <= 0) this.kind = null;
    if (!this.kind && this.queue.length > 0) { this.kind = this.queue.shift() ?? null; this.left = HINT_FRAMES; }
  }
  /** Current hint and its opacity (fades in over the first and out over the last HINT_FADE frames), or null. */
  get current(): { kind: HintKind; alpha: number } | null {
    if (!this.kind) return null;
    const age = HINT_FRAMES - this.left;
    return { kind: this.kind, alpha: Math.max(0, Math.min(1, (age + 1) / HINT_FADE, this.left / HINT_FADE)) };
  }
}
