# GFX — graphics overhaul test evidence

Date: 2026-11-05. Node v26.10.0 (engine warning: project pins 24.22.2).

## Checks (one chained run, exit 0)
`pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:browser`
- typecheck: `tsc -b` clean
- lint: `boundaries ok`, `timers ok`
- test: `Test Files 48 passed (48)`, `Tests 596 passed (596)` (includes new `tests/unit/render-gfx.test.ts`, 8 tests: ease, squashFor, moodFor, shade/light/mix, lowHealth, meterSegments, boltJitter/hash01, cachedGrad)
- build: `✓ built in 67ms` (main JS 408.60 kB, gzip 129.46 kB)
- test:browser: `3 passed (19.9s)` (cpu-match, online-two-tabs, title)

## Frame pacing (headless Chromium, 1280×720, CPU throttle 4×, 180 rAF frames, CPU vs match)
| | rooftop | bamboo | volcano |
|---|---|---|---|
| before GFX (stashed tree) | 16.67 ms | 16.67 ms | 16.67 ms |
| GFX with full-screen vignette (rejected) | 22.13 ms | 23.52 ms | 22.41 ms |
| GFX final | 16.67 ms | 17.04 ms | 16.67 ms |
Profiler: JS self time negligible; cost was raster of the full-screen vignette, now removed.

## Screenshots (Playwright, dev server)
Before: `GFX-before-{gallery,title,select,vs,fight-rooftop,fight-bamboo,fight-volcano,ko}.png`
After: `GFX-after-{gallery,title,select,vs,fight-rooftop,fight-bamboo,fight-volcano,super,ko}.png`
(`GFX-before-ko.png` did not catch the K.O. moment; `GFX-after-ko.png` was taken by forcing hp 0 via the dev hook.)

## Not run
- Physical iPad 60 fps check: NOT RUN (needs a human on device).
