# TUNE test results

Commands run (all exit 0): `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:browser`
- vitest: 54 files passed, 1 skipped (the report-only win-rate harness when `TUNE_N` is unset); 643 tests passed, 1 skipped.
- playwright: 6 passed, 1 skipped.

Win rates: CPU hard vs CPU hard, 200 matches per pair (seeds 1000..1199, sides swapped on odd matches, stages rotated), first character's win rate, 0 draws.
Command: `TUNE_N=200 TUNE_OUT=<file> pnpm vitest run tests/unit/winrate.test.ts` (about 14 s for all 10 pairs).

| Pair | Win % (first) | W-L | In 35-65 | In 40-60 |
|---|---|---|---|---|
| bolt v volt | 58.0 | 116-84 | yes | yes |
| bolt v chompa | 37.5 | 75-125 | yes | no |
| bolt v kaze | 76.5 | 153-47 | NO | no |
| bolt v bao | 45.0 | 90-110 | yes | yes |
| volt v chompa | 52.0 | 104-96 | yes | yes |
| volt v kaze | 62.5 | 125-75 | yes | no |
| volt v bao | 56.0 | 112-88 | yes | yes |
| chompa v kaze | 51.5 | 103-97 | yes | yes |
| chompa v bao | 32.5 | 65-135 | NO | no |
| kaze v bao | 53.0 | 106-94 | yes | yes |

Progress (pairs outside 35-65 %): before any change 8 of 10 (several at 0 / 100 %); after the CPU super fix 5; after tuning passes 2 (Bolt v Kaze, Chompa v Bao). Passes 1-3 and the follow-up adjustments are in decision 0018. Per the owner's no-pause instruction the final numbers are recorded and the slice continued.
Physical iPad checks: NOT RUN.
