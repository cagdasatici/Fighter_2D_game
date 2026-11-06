# HELP1 test evidence

Date: 2026-11-06. Client UI only (`apps/client/src/ui/*`, `AppFlow.ts`); sim and CPU untouched.

Commands run (all exit 0): `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- vitest: 55 files passed, 1 skipped (win-rate harness); 655 tests passed, 1 skipped. New: `tests/unit/help1.test.ts` (12 tests: move list rows per character, rebound keys, P1-only pad/touch labels, hint triggers, once-per-match queue, fade, Hints setting).
- build: `vite built` OK.
- `HELP1_SHOTS=docs/test-results npx playwright test tests/browser/help1-shots.spec.ts tests/browser/menus.spec.ts`: 3 passed (shots + existing menus spec).

Screenshots: `docs/test-results/HELP1-movelist.png` (pause > Move List, Bolt), `docs/test-results/HELP1-hint.png` ("SP + direction = special" at round 1 start).

Not run: physical iPad/gamepad checks, online play with hints, `pnpm test:browser` full suite.
Limits: super hint text names the keyboard SU key only (pad RT / touch SUPER are not named). In local 2P both players get hints (P2 right-aligned). Move List super row shows the data notation "+ P" (generic punch) while the shortcut uses HP/HK per character.
