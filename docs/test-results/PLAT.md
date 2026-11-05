# PLAT test results

Commands run (real output):
- `pnpm typecheck` ok
- `pnpm lint` boundaries ok, timers ok
- `pnpm test` 53 files passed, 631 tests passed (includes tests/unit/platforms.test.ts: 8 tests; determinism and rollback suites unchanged and passing)
- `pnpm build` built ok
- `pnpm test:browser` 6 passed (cpu-match, menus x2, online two tabs rollback, perf x3 stages avg 16.7-17.5 ms under 4x throttle, title)

Platform constants (sim units, 100 = 1 px): minApex 11760 (chompa, jumpVy 1500, gravity 90), LOW y 6400, HIGH y 10800 (lowered by TUNE, decision 0018).
Layout (all stages): HIGH x [-9000, 9000]; LOW x [-34000, -16000] and [16000, 34000].
Drop-through: 2 DOWN presses within 12 frames, dropTimer 10, vy -100.

Screenshot: docs/test-results/PLAT.png (rooftop, steel beam platforms).
Physical iPad checks: NOT RUN.
