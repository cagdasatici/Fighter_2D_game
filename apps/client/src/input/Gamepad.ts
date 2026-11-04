import { DOWN, HK, HP, LEFT, LK, LP, RIGHT, UP, cleanSocd, type InputByte } from '@kb/shared';
import type { InputSource } from './InputSource.js';

export const STICK_DEADZONE = 0.4;
// Standard mapping: 0 A/×, 1 B/○, 2 X/□, 3 Y/△, 9 Start, 12-15 d-pad up/down/left/right.
const FACE: readonly [number, number][] = [[2, LP], [3, HP], [0, LK], [1, HK]];
const DPAD: readonly [number, number][] = [[12, UP], [13, DOWN], [14, LEFT], [15, RIGHT]];
const SECTORS = [RIGHT, RIGHT | UP, UP, LEFT | UP, LEFT, LEFT | DOWN, DOWN, RIGHT | DOWN];

/** Left stick (x right, y down, -1..1) → 8-way bits: deadzone 0.4, 45° sectors (spec §12.2). */
export function axesBits(x: number, y: number): InputByte {
  if (Math.hypot(x, y) < STICK_DEADZONE) return 0;
  const i = ((Math.round(Math.atan2(-y, x) / (Math.PI / 4)) % 8) + 8) % 8;
  return SECTORS[i] ?? 0;
}

export interface PadLike { mapping: string; axes: readonly number[]; buttons: readonly { pressed: boolean }[] }
export function padBits(p: PadLike): InputByte {
  let b = axesBits(p.axes[0] ?? 0, p.axes[1] ?? 0);
  for (const [i, bit] of [...DPAD, ...FACE]) if (p.buttons[i]?.pressed) b |= bit;
  return cleanSocd(b);
}

/** Polls the Gamepad API each read: first connected pad → P1, second → P2. Start toggles pause. No listeners to clean up. */
export class Gamepad implements InputSource {
  private startHeld = false;
  constructor(private readonly onPause: () => void = () => {}) {}
  read(): [InputByte, InputByte] {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads().filter((p): p is globalThis.Gamepad => p !== null && p.connected) : [];
    const out: [InputByte, InputByte] = [0, 0];
    pads.slice(0, 2).forEach((p, i) => { out[i] = padBits(p); });
    const start = pads.some(p => p.buttons[9]?.pressed === true);
    if (start && !this.startHeld) this.onPause();
    this.startHeld = start;
    return out;
  }
  dispose(): void { this.startHeld = false; }
}
