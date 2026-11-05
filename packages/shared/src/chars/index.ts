import { BAO } from "./bao.js";
import { BOLT } from "./bolt.js";
import { CHOMPA } from "./chompa.js";
import { KAZE } from "./kaze.js";
import { VOLT } from "./volt.js";
import { tuned } from "./tuning.js";
import type { CharDef, CharId, MoveDef } from "./types.js";

export * from "./types.js";
export { BASE_IDS, BASE_NORMALS, normal } from "./base.js";
export { BAO, BOLT, CHOMPA, KAZE, VOLT };

const AUTHORED: Record<CharId, CharDef> = { bolt: BOLT, volt: VOLT, chompa: CHOMPA, kaze: KAZE, bao: BAO };
export const CHARS: Record<CharId, CharDef> = {
  bolt: tuned(BOLT), volt: tuned(VOLT), chompa: tuned(CHOMPA), kaze: tuned(KAZE), bao: tuned(BAO),
};

/** Test hook (decision 0018): `false` swaps every char's moves back to the authored (untuned) data in place. */
export function setTuning(on: boolean): void {
  for (const id of Object.keys(CHARS) as CharId[]) CHARS[id].moves = on ? tuned(AUTHORED[id]).moves : AUTHORED[id].moves;
}
export { AUTHORED as AUTHORED_CHARS };

export function getMove(charId: CharId, moveId: string): MoveDef | undefined {
  return CHARS[charId].moves.find((m) => m.id === moveId);
}
