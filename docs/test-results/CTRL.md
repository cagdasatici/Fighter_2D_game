# CTRL test results

Commands run (real output):
- `pnpm typecheck` - pass (tsc -b, no errors)
- `pnpm lint` - boundaries ok, timers ok
- `pnpm test` - Test Files 52 passed (52); Tests 623 passed (623)
- `pnpm build` - built OK
- `pnpm test:browser` - 6 passed

Golden hashes: none needed regenerating (determinism suite passed unchanged). Updated sim-combo meter expectations to 30/18 (hit) and 15/0 (block).

Device checks (physical iPad touch SP/SUPER buttons, real gamepad RB/RT): NOT RUN.
