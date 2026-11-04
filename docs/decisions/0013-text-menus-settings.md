# 0013 — Text, menus and settings (TXT)

Status: ACCEPTED (owner request, pre-approved, no questions; 2026-11-05). Visual style of decision 0012 kept.

**Copy.** All player-facing labels live with their screens; shared copy is in `apps/client/src/ui/text.ts` (pure,
unit-tested): stage display names (`rooftop`→Rooftop, `bamboo`→Bamboo Grove, `volcano`→Volcano), key labels
(`KeyW`→W, `Numpad4`→Num 4, `ArrowUp`→↑), CPU difficulty names + one-line descriptions, action names (Light Punch…),
and network error sentences per `ClientError` code (`ROOM_FULL` also covers `SEAT_TAKEN`/locked rooms, as
RoomClient already maps them). Button labels use Title Case; hints and errors are short full sentences. In-fight HUD
text stays ALL CAPS per spec §9.6; the training readout is now `FRAME ADV n`.

**Navigation.** `dom.ts` `menuNav()` is the single model for every menu: ↑/↓ (W/S) move focus, Enter/Space press,
Esc = back; gamepad d-pad/stick move focus, A press, B back (edge-triggered rAF poll, the first poll only records
held buttons so the press that opened a screen does not act again; cancelled on cleanup). Back targets: Settings,
How to Play, Character Select, Play Online → Title; Room → leave room; Results → Character Select (online: leave
room); Touch layout → save and return; Pause → B resumes (Esc already toggles pause in `Keyboard`). Character
select keeps arrows/keys for the fighter cursors (`keys: false`).

**Settings.** Sections Audio · Gameplay · Controls · Display (dev build only, hitboxes). Sliders step 5 % and show
their value; toggles show On/Off; difficulty shows its description. "Reset to defaults" restores every field
(`resetSettings`, in place); "Reset keys" only keys. Rebinding shows "Press a key for P1 Light Punch. Esc cancels."
and reports swaps ("…It was used by P1 Heavy Kick, which moved to U.") or reserved keys. `rebind()` now returns
`{ ok, reserved, swapped }`. Storage key/format unchanged (`kb.settings.v1`), so saved settings carry over.

**Online.** Sign-in, room-list and join failures show the mapped sentence (invite expired, room full, server
unreachable, outdated build, open join off). A dropped room connection returns to Play Online with
"Disconnected from the room…" instead of silently going to the title. Room shows "Waiting for opponent…" while alone.
Online results: Rematch becomes "Rematch requested" + "Waiting for opponent…"; if the opponent leaves, "Your opponent
left the room." and Rematch is disabled. Online results' second button is "Leave Room".

**How to Play.** Tabs Basics · Keyboard (live bindings for P1 and P2) · Gamepad · Touch (incl. per-character SP
easy-special list generated from `SP_TABLE` + move names, with the charge fallback and SP SP super) · Moves
(unchanged notation from data).

**Admin page (closes the 0011 gap).** `apps/client/admin.html` + `src/admin/{main,api,screens}.ts, admin.css`
copied from battlegrounds WEB5. Changes: names, `@kb/shared/net/admin` import, Rooms form adapted to the KB schema
(`bots` 0..1 — "Fill seat 2 with a CPU"; no difficulty/round target). Vite builds it as a second entry; admin chunks
are named `assets/admin-*` and excluded from the offline precache (sw.js already bypasses `/admin*`). The server
already served `/admin.html` (staticFiles) and the API; no server change.

**Limits.** Gamepad menu navigation and touch flows were not exercised on real hardware (no pad / iPad here).
Room "Waiting for opponent" and online rematch wait are covered by code review + the existing two-tab test only up
to Ready, not through a rematch.
