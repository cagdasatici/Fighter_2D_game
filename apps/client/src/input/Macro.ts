import { DOWN, HK, HP, LEFT, LK, LP, RIGHT, UP, numpad, type CharId, type InputByte } from '@kb/shared';

/** Easy-special (spec §12.3, characters.md "SP macros"). Pure: no DOM, no timers. */
export type SpDir = 'neutral' | 'up' | 'back' | 'down';
type Motion = 'qcf' | 'qcb' | 'dp' | 'dd' | 'spin' | 'charge';
export interface MacroEntry { motion: Motion; button: number; move: string }
interface CharMacros { neutral: MacroEntry; up: MacroEntry; back: MacroEntry; down: MacroEntry; downUncharged: MacroEntry; superButton: number; superMove: string }

const e = (motion: Motion, button: number, move: string): MacroEntry => ({ motion, button, move });

/** Per-character SP tables (characters.md §2-§6). `downUncharged` equals `down` for characters without a charge move. */
export const SP_TABLE: Readonly<Record<CharId, CharMacros>> = {
  // Two specials per character (owner request 2026-11-06): neutral/down = special 1 (H/L), up/back = special 2 (H/L).
  bolt: {
    neutral: e('qcf', HP, 'rivetShot.H'), down: e('qcf', LP, 'rivetShot.L'), up: e('dp', HP, 'jackhammerRise.H'), back: e('dp', LP, 'jackhammerRise.L'),
    downUncharged: e('qcf', LP, 'rivetShot.L'), superButton: HP, superMove: 'demolitionDrive',
  },
  volt: {
    neutral: e('qcf', HP, 'staticSpark.H'), down: e('qcf', LP, 'staticSpark.L'), up: e('dp', HK, 'liveWireHop.H'), back: e('dp', LK, 'liveWireHop.L'),
    downUncharged: e('qcf', LP, 'staticSpark.L'), superButton: HP, superMove: 'overload',
  },
  chompa: {
    neutral: e('qcb', HP, 'eggLob.H'), down: e('qcb', LP, 'eggLob.L'), up: e('spin', HP, 'gulpGrab.H'), back: e('spin', LP, 'gulpGrab.L'),
    downUncharged: e('qcb', LP, 'eggLob.L'), superButton: HK, superMove: 'stampedeRoll',
  },
  kaze: {
    neutral: e('qcf', HP, 'shurikenFan.H'), down: e('qcf', LP, 'shurikenFan.L'), up: e('dp', HK, 'risingCrane.H'), back: e('dp', LK, 'risingCrane.L'),
    downUncharged: e('qcf', LP, 'shurikenFan.L'), superButton: HP, superMove: 'thousandShadows',
  },
  bao: {
    neutral: e('qcf', HP, 'jadePalm.H'), down: e('qcf', LP, 'jadePalm.L'), up: e('qcb', HK, 'bambooCounter.H'), back: e('qcb', LK, 'bambooCounter.L'),
    downUncharged: e('qcf', LP, 'jadePalm.L'), superButton: HP, superMove: 'dragonDumpling',
  },
};

/** Numpad sequences (relative to facing); 5 = neutral. Button is OR-ed onto the last frame. */
const SEQ: Readonly<Record<Motion, readonly number[]>> = {
  qcf: [2, 3, 6], qcb: [2, 1, 4], dp: [6, 2, 3], dd: [2, 5, 2],
  spin: [6, 3, 2, 1, 4, 7, 8], // characters.md (Chompa up); spec §5.3 lets a 360 cancel jump squat frames 1-2
  charge: [6], // the back-hold already happened before SP (spec §12.3: ≥40 frames, else the alternate is used)
};
const SUPER_SEQ = [2, 3, 6, 2, 3, 6];

/** Numpad digit → absolute input byte for a facing. */
export function fromNumpad(np: number, facing: 1 | -1): InputByte {
  const fwd = facing === 1 ? RIGHT : LEFT, back = facing === 1 ? LEFT : RIGHT;
  const col = (np - 1) % 3, row = Math.trunc((np - 1) / 3);
  return (col === 0 ? back : col === 2 ? fwd : 0) | (row === 0 ? DOWN : row === 2 ? UP : 0);
}

/** Stick direction at the press frame → SP row. Up wins over back/down; neutral covers forward. */
export function spDirection(stick: InputByte, facing: 1 | -1): SpDir {
  const np = numpad(stick, facing);
  if (np >= 7) return 'up';
  if (np === 4 || np === 1) return 'back';
  if (np === 2 || np === 3) return 'down';
  return 'neutral';
}

export function macroEntry(char: CharId, dir: SpDir, charged: boolean): MacroEntry {
  const t = SP_TABLE[char];
  return dir === 'down' && !charged ? t.downUncharged : t[dir];
}

const toBytes = (seq: readonly number[], button: number, facing: 1 | -1): InputByte[] =>
  seq.map((np, i) => fromNumpad(np, facing) | (i === seq.length - 1 ? button : 0));

/** One direction per frame, button on the last frame, using the facing at the press frame. */
export function buildMacro(char: CharId, dir: SpDir, facing: 1 | -1, charged: boolean): InputByte[] {
  const m = macroEntry(char, dir, charged);
  return toBytes(SEQ[m.motion], m.button, facing);
}
export function buildSuper(char: CharId, facing: 1 | -1): InputByte[] {
  return toBytes(SUPER_SEQ, SP_TABLE[char].superButton, facing);
}

export interface SpContext { char: CharId; facing: 1 | -1; charged: boolean; meterFull: boolean }

/** Display name of the move `SP` triggers for a stick direction (touch label, decision 0014). */
export function spLabel(char: CharId, dir: SpDir, charged: boolean, name: (move: string) => string): string {
  return name(macroEntry(char, dir, charged).move);
}

/**
 * One per local player, shared by keyboard, pad and touch (decision 0014). Plays macros into the input stream,
 * one byte per sampled frame. SU plays the super only with a full meter; otherwise it is ignored (no queueing).
 */
export class MacroPlayer {
  private queue: InputByte[] = [];
  /** Call once per frame. `sp`/`su` = that button went down since the last frame. */
  next(live: InputByte, sp: boolean, su: boolean, ctx: SpContext | null): InputByte {
    if (ctx && su && ctx.meterFull) this.queue = buildSuper(ctx.char, ctx.facing);
    else if (ctx && sp) this.queue = buildMacro(ctx.char, spDirection(live, ctx.facing), ctx.facing, ctx.charged);
    return this.queue.shift() ?? live;
  }
  get playing(): boolean { return this.queue.length > 0; }
  reset(): void { this.queue = []; }
}
