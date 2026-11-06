# TUNE2 test results

Change: `packages/shared/src/ai/cpu.ts` only (Kaze close-range overhead/low mix + shuriken 60 % far; Bao `bambooCounter.L` 30 % vs predicted jump-in). No character data changed.

Commands run (all exit 0): `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- vitest: 54 files passed, 1 skipped (win-rate harness, unset TUNE_N); 643 tests passed, 1 skipped.
- `pnpm test:browser` NOT RUN. Physical iPad checks: NOT RUN.

Win rates: `TUNE_N=200 TUNE_OUT=<file> pnpm vitest run tests/unit/winrate.test.ts` (CPU hard vs hard, 200 matches/pair, seeds 1000..1199, first character's win rate).

| Pair | Before % | After % | After W-L |
|---|---|---|---|
| bolt v volt | 58.0 | 58.0 | 116-84 |
| bolt v chompa | 37.5 | 37.5 | 75-125 |
| bolt v kaze | 76.5 | 54.5 | 109-91 |
| bolt v bao | 45.0 | 43.0 | 86-114 |
| volt v chompa | 52.0 | 52.0 | 104-96 |
| volt v kaze | 62.5 | 62.5 | 125-75 |
| volt v bao | 56.0 | 56.5 | 113-87 |
| chompa v kaze | 51.5 | 52.5 | 105-95 |
| chompa v bao | 32.5 | 39.5 | 79-121 |
| kaze v bao | 53.0 | 44.0 | 88-112 |

All 10 pairs are inside 35-65 % (range 37.5-62.5). Limit: results are sensitive to the style percentages (neighbouring values moved Volt v Kaze between 62 and 71 %), so any later change to cpu.ts or char data needs a re-run. Tuning knobs: `KAZE_*` constants in cpu.ts (`TODO(tune)`).
