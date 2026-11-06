# PERF1 - test evidence

Date: 2026-11-06. Render only (`apps/client/src/render/stages/volcano.ts`); sim, CPU and balance untouched.

## Method
`PERF_OUT=f npx playwright test tests/browser/perf.spec.ts` (4x CPU throttle, 600 frames, CPU opponent, same machine, same session). Columns: avg / p95 / max frame ms, main-thread ms per frame (TaskDuration).
Before = tree at 007fba9 (1 run; the FX.md runs of the same tree gave volcano p95 22.4-23.8).

## Before (1 run)
| stage | avg | p95 | max | task ms/frame |
|---|---|---|---|---|
| rooftop | 17.03 | 17.8 | 34.3 | 8.15 |
| bamboo | 17.03 | 17.8 | 47.2 | 9.42 |
| volcano | 18.58 | 24.6 | 31.5 | 13.06 |

## After (3 runs of the final tree, listed run1 / run2 / run3)
| stage | avg | p95 | max | task ms/frame |
|---|---|---|---|---|
| rooftop | 17.25 / 17.36 / 17.22 | 20.5 / 28.3 / 19.0 | 33.2 / 33.2 / 34.3 | 8.87 / 8.83 / 8.45 |
| bamboo | 17.03 / 17.81 / 17.81 | 18.1 / 37.9 / 38.1 | 49.9 / 46.2 / 44.9 | 9.44 / 10.55 / 10.58 |
| volcano | 17.61 / 17.67 / 17.19 | 23.4 / 23.8 / 22.6 | 25.9 / 28.3 / 25.8 | 10.20 / 10.37 / 8.97 |

(Intermediate: embers+cracks only gave volcano task 12.42; adding the tight mountain bitmap gave about 10. A 4-puff smoke experiment gave no measurable gain and was reverted.)

## Reading
- Main-thread cost on volcano fell from 13.1 to about 9-10.4 ms/frame (-20 to -30 %), now close to bamboo (9.4-10.6) and rooftop (8.2-8.9).
- Worst single frame (max) on volcano is 25.8-28.3 ms, lower than rooftop (33-34) and bamboo (45-50); it was 31.5.
- p95 target NOT met: volcano p95 still 22.6-23.8 vs 18-19 for rooftop/bamboo on quiet runs (about 1 ms better than 24.6). Other stages' p95 swings 18-38 between identical runs, so machine noise exceeds the remaining gap; no further cheap single cause was found (remaining cost is spread: smoke about 1.1 ms, ridge about 0.7, embers, ferns, floor).
- Visual change: lava streams are a fixed colour (no pulse); cracks pulse in brightness only; embers use 2 alpha bands instead of continuous alpha.

## Checks (exit 0 each)
- `pnpm typecheck`: clean
- `pnpm lint`: `boundaries ok`, `timers ok`
- `pnpm test`: `Test Files 54 passed | 1 skipped (55)`, `Tests 643 passed | 1 skipped (644)`
- `pnpm build`: `built in 194ms`

## Not run
- Physical iPad check: NOT RUN. Volcano screenshots not re-taken.
