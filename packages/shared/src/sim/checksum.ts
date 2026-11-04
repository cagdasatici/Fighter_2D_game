import type { MatchState } from "./types.js";

/** FNV-1a 32-bit over JSON.stringify(s) (spec §3.4). Unsigned 32-bit result. */
export function checksum(s: MatchState): number {
  const str = JSON.stringify(s);
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
