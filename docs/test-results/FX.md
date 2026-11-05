# FX - test evidence

Date: 2026-11-05. Node v26.10.0 (engine warning: project pins 24.22.2). Slice commit hash: see docs/tasks.md FX row. Sim untouched.

## Checks (one chained run, exit 0)
`pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:browser`
- typecheck: `tsc -b` clean
- lint: `boundaries ok`, `timers ok`
- test: `Test Files 54 passed (54)`, `Tests 642 passed (642)` (new `tests/unit/fx.test.ts`, 11 tests: trauma clamp/decay, shake amplitude and off switch, once-per-frame camera events, punch zoom, trail ring <= 6, 1000 events under cap 256 / 128 with lowFx, hit flash, no replay, combo pop/colour, pitch cap, thump layer)
- build: `built in 67ms` (main JS 327.22 kB, gzip 108.68 kB; was 311.71 / 103.25)
- test:browser: `6 passed, 1 skipped` (fx-shots is gated by FX_SHOTS)

## Screenshots
`docs/test-results/FX-hit.png`, `FX-block.png`, `FX-super.png`, `FX-ko.png` (rooftop / bamboo / volcano / rooftop), made by `FX_SHOTS=<dir> npx playwright test tests/browser/fx-shots.spec.ts` with the match paused and stepped frame by frame.

## PERF re-measure (`PERF_OUT=f npx playwright test tests/browser/perf.spec.ts`, 4x CPU throttle, 600 frames)
Baseline = tree before FX (same session); after = FX tree; two runs each where noted.
| stage | avg ms before | avg ms after | p95 before | p95 after | main-thread ms/frame before | after |
|---|---|---|---|---|---|---|
| rooftop | 16.67 | 16.94 / 17.25 / 18.06 / 17.22 | 18.6 | 18.8 / 23.3 / 28.9 / 21.1 | 7.23 | 7.75 / 8.38 / 10.0 / 8.31 |
| bamboo | 16.67 | 16.66 / 16.66 / 16.67 / 17.11 | 18.5 | 18.3 / 18.7 / 18.5 / 18.9 | 8.61 | 8.53 / 8.48 / 8.5 / 9.22 |
| volcano | 17.11 | 17.5 / 17.58 / 17.56 / 17.67 | 21.3 | 22.4 / 23.1 / 23.0 / 23.8 | 8.36 | 9.52 / 10.13 / 10.17 / 10.13 |
Reading: FX adds roughly 0.5-1 ms of main-thread time per frame while fighting (particles and trails are only live during hits). Averages stay at vsync. p95 on rooftop and volcano is noisy on this machine (rooftop p95 ranged 18.8-28.9 across identical runs); the volcano p95 gap (about 23 ms vs 18.5 for bamboo) predates FX (21.3 before) and is investigated in decision 0017 (smoke now cached; no single cheap cause found).

## Not run
- Physical iPad check: NOT RUN.
- Audio pitch/thump by ear: NOT RUN (unit tests cover the cue table only).
