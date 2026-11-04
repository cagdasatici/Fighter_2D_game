import type { InputByte } from "./buttons.js";

/** Ring buffer owner. `historyHead` is the index of the newest byte; ring length = `history.length` (INPUT_HISTORY). */
export interface HistoryOwner { history: number[]; historyHead: number }

/** Advance the head and write this frame's byte. */
export function pushInput(f: HistoryOwner, b: InputByte): void {
  const n = f.history.length;
  f.historyHead = (f.historyHead + 1) % n;
  f.history[f.historyHead] = b;
}

/** Byte written `ago` frames back (0 = this frame). `ago` must be in [0, history.length). */
export function inputAt(f: HistoryOwner, ago: number): InputByte {
  const n = f.history.length;
  return f.history[(((f.historyHead - ago) % n) + n) % n] ?? 0;
}

/** True when any bit of `mask` is set at `ago` and clear at `ago + 1`. */
export function pressed(f: HistoryOwner, mask: number, ago = 0): boolean {
  return (inputAt(f, ago) & mask) !== 0 && (inputAt(f, ago + 1) & mask) === 0;
}

/** Consecutive frames, newest first, for which `predicate` holds (max history.length). */
export function heldFrames(f: HistoryOwner, predicate: (b: InputByte) => boolean): number {
  const n = f.history.length;
  let c = 0;
  while (c < n && predicate(inputAt(f, c))) c++;
  return c;
}
