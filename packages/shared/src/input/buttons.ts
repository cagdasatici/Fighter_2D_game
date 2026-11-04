export const UP = 1, DOWN = 2, LEFT = 4, RIGHT = 8, LP = 16, HP = 32, LK = 64, HK = 128;
export type InputByte = number; // 0..255
/** Clean SOCD: left+right = neutral; up+down = up. */
export function cleanSocd(b: InputByte): InputByte {
  if ((b & LEFT) && (b & RIGHT)) b &= ~(LEFT | RIGHT);
  if ((b & UP) && (b & DOWN)) b &= ~DOWN;
  return b;
}
/** Numpad direction 1..9 relative to facing. */
export function numpad(b: InputByte, facing: 1 | -1): number {
  const fwd = facing === 1 ? RIGHT : LEFT, back = facing === 1 ? LEFT : RIGHT;
  const h = (b & fwd) ? 1 : (b & back) ? -1 : 0;
  const v = (b & UP) ? 1 : (b & DOWN) ? -1 : 0;
  return 5 + h + v * 3;
}
