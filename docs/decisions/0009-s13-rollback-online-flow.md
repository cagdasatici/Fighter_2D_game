# 0009: S13 rollback client and online flow

Status: ACCEPTED (owner pre-approved run 2026-11-04; decided in the S13 session without owner questions).

- **Clock source.** The protocol has no ping message, so `ClockSync` (copied from battlegrounds) samples a new
  stateless HTTP route `GET /api/time` → `{ serverMs }` (added to `apps/server/src/http/sessionRoutes.ts`) once per
  second while seated. Offset = median of 8 ping-midpoint samples; `rttMs` = median of the same 8 round trips (HTTP
  RTT stands in for the websocket RTT in the `lead` formula).
- **Rollback base.** Mispredictions are only detectable on confirmed frames, so `rollbackFrom <= cf` always and the
  rollback re-simulates from `clone(confirmed)`; the snapshot-ring branch of §11.4 step 4 is kept but unreachable in
  practice. When the server's `cf` passes `currentFrame`, the client jumps to the confirmed state (no FX for the skipped frames).
- **FX/SFX.** `Rollback.takeEvents()` returns events of frames shown for the first time (forward prediction only);
  re-simulated and skipped frames never add events (`lastFxFrame`). AppFlow feeds these to `Fx.consume`/`cuesForFrame`.
- **End.** On `end` the client drops predictions past `cf`, stops ticking and shows Results 90 ticks later with the
  server's winner (covers forfeits). Rollback sends `ack` for every hash frame it has confirmed and `resync` on mismatch
  or on a `cf` gap.
- **Online flow.** Title "Play Online" is enabled → `Lobby` (sign-in via `#invite=` token + name, or open join
  Arel/Nora; then the copied `RoomList`) → in-room panel in `ui/Lobby.ts` (compact fighter buttons, Ready, and for a
  lone host a "CPU opponent" row that sends the 0008 `bot` message with the Settings difficulty) → VsScreen → fight →
  Results (Rematch sends `rematch`; Character Select returns to the room list; Title leaves). The full `CharSelect`
  screen is not reused online (it picks both fighters); stage is the server's rule. Online has no pause.
- **Endpoints.** The client uses same-origin HTTP and `ws(s)://location.host`, i.e. it must be served by the game
  server (built client). TODO: Vite dev proxy for `/api` + websocket when a dev-server online workflow is needed.
- RTT display (`RTT n ms`, plus `STALL`) is drawn bottom-right in dev builds only.
