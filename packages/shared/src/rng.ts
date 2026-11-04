export function nextRng(s: number): number { // xorshift32, never returns 0 for s != 0
  let x = s | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0;
}
export function rngInt(state: { rng: number }, n: number): number { // 0..n-1
  state.rng = nextRng(state.rng); return state.rng % n;
}
