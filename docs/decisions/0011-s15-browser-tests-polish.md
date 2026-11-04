# 0011: S15 browser tests, polish pass and release checklist

Status: ACCEPTED (owner pre-approved run 2026-11-04; decided in the S15 session without owner questions).

- **Browser test harness.** `playwright.config.ts` starts two web servers: the real game server (`apps/server/src/main.ts`,
  `NODE_ENV=development`, port 25690, `OPEN_JOIN=1`, admin off, throwaway `DATA_DIR`) and the Vite **dev** client on
  `http://localhost:5199` (proxy to 25690). The dev client is used because spec §16's `window.__kb` hook exists only in
  dev builds. The production bundle is covered by `pnpm build`, not by Playwright.
- **Tests** (`tests/browser/`): `title.spec.ts` (menu + no console errors), `cpu-match.spec.ts` (Versus CPU on easy via
  the UI and keyboard, canvas pixel variety > 8 colours, then walk in + LP/HP/HK until P2's comboHits > 0 or hp drops),
  `online-two-tabs.spec.ts` (two browser contexts sign in with open join as Arel/Nora, join the Play room, ready, both
  reach `fight`, same chars, P1 walking in tab A is seen in tab B). Open join replaces invitations here so the test needs
  no token handling; invitations stay covered by `tests/integration/auth.test.ts`. Shared code in `tests/browser/helpers.ts`.
- **Polish fix: sub-frame key taps.** `Keyboard` dropped a key pressed and released between two ticks (found by the
  CPU-match test). It now latches presses until the next `read()` (`tapped` set; cleared by blur/visibility/setKeys).
  Unit test: `tests/unit/keyboard-tap.test.ts` (fails without the fix).
- **Known gap, not fixed:** spec §14 lists `admin.html` / `admin/*` for copying, but no admin page exists in the client;
  `pnpm play` still prints an `/admin.html` link (play.ts belongs to S14). The admin API works. README states this.
  Left for the menus/settings review task.
- **Release checklist** (`docs/release-checklist.md`) lists every special/super from the live character data (37 moves);
  all physical checks are unticked / NOT RUN.
