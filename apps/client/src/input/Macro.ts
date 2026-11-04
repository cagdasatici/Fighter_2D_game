import { DOWN, HK, HP, LEFT, LK, LP, RIGHT, UP, numpad, type CharId, type InputByte } from '@kb/shared';

/** Easy-special (spec §12.3, characters.md "SP macros"). Pure: no DOM, no timers. */
export type SpDir = 'neutral' | 'up' | 'back' | 'down';
type Motion = 'qcf' | 'qcb' | 'dp' | 'dd' | 'spin' | 'charge';
export interface MacroEntry { motion: Motion; button: number; move: string }
interface CharMacros { neutral: MacroEntry; up: MacroEntry; back: MacroEntry; down: MacroEntry; downUncharged: MacroEntry; superButton: number; superMove: string }

const e = (motion: Motion, button: number, move: string): MacroEntry => ({ motion, button, move });

/** Per-character SP tables (characters.md §2-§6). `downUncharged` equals `down` for characters without a charge move. */
export const SP_TABLE: Readonly<Record<CharId, CharMacros>> = {
  bolt: {
    neutral: e('qcf', HP, 'rivetShot.H'), up: e('dp', HP, 'jackhammerRise.H'), back: e('qcb', HK, 'hardHatHop.H'),
    down: e('qcf', LP, 'rivetShot.L'), downUncharged: e('qcf', LP, 'rivetShot.L'), superButton: HP, superMove: 'demolitionDrive',
  },
  volt: {
    neutral: e('qcf', HP, 'staticSpark.H'), up: e('dp', HK, 'liveWireHop.H'), back: e('qcb', HP, 'coilWhip.H'),
    down: e('qcf', LP, 'staticSpark.L'), downUncharged: e('qcf', LP, 'staticSpark.L'), superButton: HP, superMove: 'overload',
  },
  chompa: {
    neutral: e('qcb', HP, 'eggLob.H'), up: e('spin', HP, 'gulpGrab.H'), back: e('qcb', LP, 'eggLob.L'),
    down: e('charge', HK, 'tailSpin.H'), downUncharged: e('spin', LP, 'gulpGrab.L'), superButton: HK, superMove: 'stampedeRoll',
  },
  kaze: {
    neutral: e('qcf', HP, 'shurikenFan.H'), up: e('dp', HK, 'risingCrane.H'), back: e('dd', LK, 'smokeStep.L'),
    down: e('dd', HK, 'smokeStep.H'), downUncharged: e('dd', HK, 'smokeStep.H'), superButton: HP, superMove: 'thousandShadows',
  },
  bao: {
    neutral: e('qcf', HP, 'jadePalm.H'), up: e('qcb', LK, 'bambooCounter.L'), back: e('qcb', HK, 'bambooCounter.H'),
    down: e('charge', HP, 'rollingBun.H'), downUncharged: e('qcf', LP, 'jadePalm.L'), superButton: HP, superMove: 'dragonDumpling',
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

export const DOUBLE_SP_FRAMES = 20;
export interface SpContext { char: CharId; facing: 1 | -1; charged: boolean; meterFull: boolean }

/** Plays macros into the input stream, one byte per sampled frame. A second SP within 20 frames with full meter → super. */
export class MacroPlayer {
  private queue: InputByte[] = [];
  private sinceSp = Number.MAX_SAFE_INTEGER;
  /** Call once per frame. `spPressed` = SP went down since the last frame. */
  next(live: InputByte, spPressed: boolean, ctx: SpContext | null): InputByte {
    this.sinceSp++;
    if (spPressed && ctx) {
      if (this.sinceSp <= DOUBLE_SP_FRAMES && ctx.meterFull) {
        this.queue = buildSuper(ctx.char, ctx.facing);
        this.sinceSp = Number.MAX_SAFE_INTEGER;
      } else {
        this.queue = buildMacro(ctx.char, spDirection(live, ctx.facing), ctx.facing, ctx.charged);
        this.sinceSp = 0;
      }
    }
    return this.queue.shift() ?? live;
  }
  get playing(): boolean { return this.queue.length > 0; }
  reset(): void { this.queue = []; this.sinceSp = Number.MAX_SAFE_INTEGER; }
}
