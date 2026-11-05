# PERF — render performance test evidence

Date: 2026-11-05. Node v26.10.0 (engine warning: project pins 24.22.2). Slice commit hash: 982926d.

## Checks (one chained run, exit 0)
`pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:browser`
- typecheck: `tsc -b` clean
- lint: `boundaries ok`, `timers ok`
- test: `Test Files 50 passed (50)`, `Tests 611 passed (611)` (new `tests/unit/perf.test.ts`, 6 tests: cacheLayer paints once / repaints after `invalidateLayers()` / scale change reallocates, backing-scale cap, FrameStats p95 + ring window, Fx pool never grows and `lowFx` halves the usable cap)
- build: `✓ built in 67ms` (main JS 311.71 kB, gzip 103.25 kB)
- test:browser: `6 passed (56.7s)` (cpu-match, menus x2, online-two-tabs, title, perf)

## Method
`tests/browser/perf.spec.ts` (`PERF_OUT=<file> npx playwright test tests/browser/perf.spec.ts`): headless Chromium 1280x720, CDP `Emulation.setCPUThrottlingRate` = 4, vite dev client, `window.__kb.start("cpu", ["bolt","volt"], stage)`, hard CPU opponent, P1 driven by scripted key presses so the fight stays live. 1.5 s warm-up, then 600 `requestAnimationFrame` frames per stage.
- `avg/p95 frame ms` = rAF interval. It is capped below by the 60 Hz vsync (16.67 ms), so it cannot show gains once a stage reaches 60 fps.
- `main-thread ms/frame` = CDP `Performance.getMetrics` `TaskDuration` delta / 600 (JS + software canvas raster on the main thread). This is the cost the change actually removes.
Each tree was measured twice (before = `git stash` of the PERF changes; the perf spec itself is untracked so it ran on both).

## Results (4x CPU throttle, 600 fight frames; run 1 / run 2)
| stage | frame ms avg before | avg after | p95 before | p95 after | main-thread ms/frame before | after | change |
|---|---|---|---|---|---|---|---|
| rooftop | 17.27 / 17.06 | 16.67 / 16.67 | 18.3 / 18.1 | 18.6 / 18.4 | 17.25 / 17.03 | 8.94 / 8.77 | -48 % |
| bamboo | 21.03 / 20.74 | 16.67 / 16.67 | 22.4 / 21.7 | 18.4 / 18.3 | 21.02 / 20.72 | 10.35 / 10.21 | -51 % |
| volcano | 18.73 / 18.44 | 17.22 / 17.22 | 19.8 / 19.5 | 23.8 / 23.7 | 18.72 / 18.44 | 9.95 / 9.77 | -47 % |

A third "after" sample taken at the end of the chained run (machine busy after the test suite): avg 17.47 / 16.66 / 17.92 ms, main-thread 9.11 / 9.14 / 11.17 ms.

## STOP condition (spec step 8: avg ms must improve >= 25 % on every stage)
- By main-thread cost per frame: met on every stage (-47 % to -51 %).
- By rAF frame interval: NOT met (rooftop -3 %, bamboo -20 %, volcano -7 %). The "before" tree was already close to vsync on rooftop/volcano, so the interval cannot fall below 16.67 ms. Volcano p95 got worse (about 23.7 ms vs 19.6 ms): occasional frames at 4x throttle; the cause was not investigated. Per the spec, the numbers are recorded and the work committed; owner review of this reading is needed.

## Visual check
Screenshots of all three stages after the change (headless, dev server) were compared by eye against `GFX-after-fight-*.png`: same look. Intentional render differences: bamboo/volcano sway is per-layer (a whole layer shifts) rather than per stalk/frond; far bamboo/fern leaf flap is dropped; rooftop floor seams are drawn per frame (vanishing point stays at screen centre).

## Not run
- Physical iPad 60 fps check: NOT RUN (needs a human on device).
- `?fps` overlay and `lowFx` auto-trigger: not exercised in a browser test (unit tests cover the ring buffer and the particle cap only).
