# 0010: S14 touch, gamepad and PWA

Status: ACCEPTED (owner pre-approved run 2026-11-04; decided in the S14 session without owner questions).

- **SP macro shapes.** One direction per frame, button OR-ed onto the last frame: qcf 2,3,6; qcb 2,1,4; dp 6,2,3;
  dd 2,5,2; spin 6,3,2,1,4,7,8 (Chompa, characters.md; the 8 frame carries the button, inside the §5.3 jump-squat
  allowance); charge = a single 6+button frame. Super = 2,3,6,2,3,6 + super button ("P" → HP, "K" → HK).
  Neutral and forward share a row (§12.3). Stick direction: any up (7/8/9) → up, 4/1 → back, 2/3 → down.
- **Charged?** Uses the sim's own `chargeReady(fighter)` (read-only) at the SP press frame, so the 10-frame grace
  covers moving the stick from back to down. Uncharged down uses characters.md's alternate.
- **Double SP.** A second SP within 20 sampled frames of the first, with meter = METER_MAX, replaces the running macro
  with the super macro; otherwise it restarts the normal macro.
- **Tests.** Every character × SP row × facing × charged/uncharged is checked against `resolveRequest`/`detectMotion`
  AND by stepping the real sim to see the listed move id start (tests/unit/macro.test.ts).
- **Input merge.** Keyboard, gamepads and touch are OR-ed per player then SOCD-cleaned. Touch is P1 only (online: the
  local seat). Gamepad 1 → P1, gamepad 2 → P2; Start (button 9) toggles pause. Face mapping per §12.2.
- **Touch UI** is DOM (not canvas), shown only in the fight scene (hidden while paused) and only after a touch is seen
  or on `(pointer: coarse)` devices. A top-centre "II" button pauses (iPad has no Esc). Stick only starts in the
  left half; one stick pointer at a time.
- **Layout editing** (`ui/LayoutEdit.ts`): button centres stored as px offsets from the bottom-right corner in
  localStorage `kb.touchLayout.v1`; drag edits that overlap, leave the screen or enter the left half are rejected; an
  unsafe stored layout falls back to the default. Opened from Settings → "Touch layout". No size/opacity edits.
- **PWA.** `public/sw.js` copied from battlegrounds (cache prefix `kb-shell-`), the build stamps `__BUILD_ID__` and
  emits `asset-manifest.json`. Registered in production builds only. Service workers need a secure context, so the
  default `pnpm play` (plain HTTP LAN) gets Add-to-Home-Screen without offline caching; `--tailscale` (HTTPS) gets
  both. `play.ts` now prints this note. No update-watcher UI (battlegrounds' UpdateWatcher not copied).
- **Vite dev proxy** (resolves the 0009 TODO): `/api`, `/matchmake`, `/healthz` and a websocket regex for Colyseus
  room paths `/<processId>/<roomId>` proxy to `127.0.0.1:${KB_SERVER_PORT:-2567}`. Not exercised against a live dev
  server in this session.
