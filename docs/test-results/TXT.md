# TXT — text, menus and settings test evidence

Date: 2026-11-05. Node v26.10.0 (engine warning: project pins 24.22.2).

## Checks (one chained run, exit 0)
`pnpm typecheck && pnpm lint && pnpm test && pnpm build && KB_SHOTS=1 pnpm test:browser`
- typecheck: `tsc -b` clean
- lint: `boundaries ok`, `timers ok`
- test: `Test Files 49 passed (49)`, `Tests 605 passed (605)` (new `tests/unit/txt-menus.test.ts`, 9 tests: stage names,
  key labels, difficulty blurbs, net error text, settings reset, rebind result/message, focus wrap, touch SP list,
  admin createRoom body)
- build: `✓ built in 65ms`; `dist/admin.html` + `assets/admin-*.js/.css` emitted; `asset-manifest.json` has 0 admin entries
- test:browser: `5 passed (20.4s)` (cpu-match, online-two-tabs, title, new menus.spec: back/Esc on every menu,
  settings persist across reload + reset, rebind prompt/conflict message, How to Play tabs, stage display names;
  admin page loads and explains a host without an admin password)

## Screenshots (from menus.spec with KB_SHOTS=1)
`TXT-title.png`, `TXT-settings.png`, `TXT-howto-touch.png`, `TXT-howto-moves.png`, `TXT-charselect.png`, `TXT-admin.png`.

## Not run
Gamepad menu navigation on a real pad; iPad touch: NOT RUN (no device). Online rematch wait screen not driven by a test.
`pnpm play` admin link: not run (interactive LAN); the built `/admin.html` and existing `admin-static` unit test cover serving.
