import { appendFileSync } from "node:fs";
import { beforeAll, it } from "vitest";
import { setTuning } from "../../packages/shared/src/chars/index.js";
import { CHAR_IDS, pairRate } from "../helpers/winrate.js";

// Report-only harness: TUNE_N=<matches per pair> pnpm vitest run tests/unit/winrate.test.ts
const N = Number(process.env.TUNE_N ?? 0);
beforeAll(() => setTuning(true));
it.skipIf(N === 0)("win-rate table", () => {
  for (let i = 0; i < CHAR_IDS.length; i++) for (let j = i + 1; j < CHAR_IDS.length; j++) {
    const r = pairRate(CHAR_IDS[i]!, CHAR_IDS[j]!, N);
    appendFileSync(process.env.TUNE_OUT ?? "/dev/stdout", `WR ${CHAR_IDS[i]} v ${CHAR_IDS[j]} ${r.rate.toFixed(1)} W${r.wins} L${r.losses} D${r.draws}\n`);
  }
}, 3_600_000);
