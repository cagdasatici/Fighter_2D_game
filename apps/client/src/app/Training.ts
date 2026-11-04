import { CHARS, DOWN, METER_MAX, ROUND_FRAMES, UP, guardInput, type InputByte, type MatchState } from '@kb/shared';

export type DummyBehaviour = 'stand' | 'crouch' | 'block' | 'jump';
export const DUMMY_BEHAVIOURS: readonly DummyBehaviour[] = ['stand', 'crouch', 'block', 'jump'];
export interface TrainingOptions { dummy: DummyBehaviour; infiniteHp: boolean; infiniteMeter: boolean }

const FREE = ['idle', 'walkF', 'walkB', 'crouch'];
const isFree = (s: MatchState, i: 0 | 1): boolean => FREE.includes(s.fighters[i].state);

/** P2 dummy input for the selected behaviour (spec §11.5). */
export function dummyInput(s: MatchState, b: DummyBehaviour): InputByte {
  switch (b) {
    case 'crouch': return DOWN;
    case 'block': return guardInput(s, 1);
    case 'jump': return UP;
    default: return 0;
  }
}

/**
 * Training-only refills applied by the local loop between steps (decision 0007): hp refills when a fighter is
 * free again or drops below half (so combos never KO), meter stays full, the round timer never runs out.
 */
export function applyTrainingRefills(s: MatchState, o: TrainingOptions): void {
  if (s.phase !== 'fight') return;
  s.timer = ROUND_FRAMES;
  for (const i of [0, 1] as const) {
    const f = s.fighters[i], max = CHARS[f.char].hp;
    if (o.infiniteHp && f.hp < max && (isFree(s, i) || f.hp * 2 < max)) f.hp = max;
    if (o.infiniteMeter) f.meter = METER_MAX;
  }
}

/**
 * Frame-advantage readout of P1's last move that connected: frames between the attacker and the defender becoming
 * actionable again (`+N` = P1 free first). Call `observe` once after every step.
 */
export class AdvantageMeter {
  private pending = false;
  private atkFree = -1;
  private defFree = -1;
  private n = 0;
  last: number | null = null;
  observe(s: MatchState): void {
    const contact = s.events.some(e => e.by === 0 && (e.kind === 'hit' || e.kind === 'block' || e.kind === 'counter'));
    if (contact) { this.pending = true; this.atkFree = -1; this.defFree = -1; this.n = 0; return; }
    if (!this.pending) return;
    this.n++;
    if (this.atkFree < 0 && isFree(s, 0)) this.atkFree = this.n;
    if (this.defFree < 0 && isFree(s, 1)) this.defFree = this.n;
    if (this.atkFree >= 0 && this.defFree >= 0) { this.last = this.defFree - this.atkFree; this.pending = false; }
    else if (this.n > 240) this.pending = false;
  }
}

export function advantageText(v: number | null): string { return v === null ? '--' : v > 0 ? `+${v}` : `${v}`; }
