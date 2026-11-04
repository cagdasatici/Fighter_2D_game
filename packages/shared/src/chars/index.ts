import { BAO } from "./bao.js";
import { BOLT } from "./bolt.js";
import { CHOMPA } from "./chompa.js";
import { KAZE } from "./kaze.js";
import { VOLT } from "./volt.js";
import type { CharDef, CharId, MoveDef } from "./types.js";

export * from "./types.js";
export { BASE_IDS, BASE_NORMALS, normal } from "./base.js";
export { BAO, BOLT, CHOMPA, KAZE, VOLT };

export const CHARS: Record<CharId, CharDef> = { bolt: BOLT, volt: VOLT, chompa: CHOMPA, kaze: KAZE, bao: BAO };

export function getMove(charId: CharId, moveId: string): MoveDef | undefined {
  return CHARS[charId].moves.find((m) => m.id === moveId);
}
