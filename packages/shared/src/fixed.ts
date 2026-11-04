export const PX = 100;
export function idiv(a: number, b: number): number { return Math.trunc(a / b); }
export function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }
export function sign(v: number): number { return v > 0 ? 1 : v < 0 ? -1 : 0; }
