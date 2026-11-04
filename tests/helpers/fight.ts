import type { CharId } from "../../packages/shared/src/chars/types.js";
import { PX } from "../../packages/shared/src/fixed.js";
import { createMatch } from "../../packages/shared/src/sim/state.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import { skipIntro } from "./run.js";

/** Fight-phase match with P1 left of P2, origins `gapPx` apart, centred on 0. */
export function at(gapPx: number, a: CharId = "bolt", b: CharId = "bolt"): MatchState {
  const s = skipIntro(createMatch({ chars: [a, b], stage: "rooftop", seed: 7 }));
  const half = (gapPx * PX) >> 1;
  s.fighters[0].x = -half; s.fighters[1].x = gapPx * PX - half;
  return s;
}
