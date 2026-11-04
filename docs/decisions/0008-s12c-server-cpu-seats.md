# 0008: S12c server CPU seats

Status: ACCEPTED (owner pre-approved run 2026-11-04; decided in the S12c session without owner questions).

- "Admin/host may fill an empty slot with a CPU" (spec §11.3) is implemented as a new client message
  `{ t: "bot", char: CharId, difficulty: "easy"|"normal"|"hard" }` (zod-validated, counted on the 5/s bucket).
  The host is the lone seated human: the message is accepted only before a match while exactly one human is seated;
  sending it again changes the CPU's char/difficulty. There is no admin HTTP endpoint and no "remove CPU" message.
- The CPU takes the free slot, shows in `lobby` as `{ name: "CPU", char, ready: true, bot: true }`, and counts as a
  seat: `onAuth` refuses a further human with `SEAT_TAKEN`. When the last human leaves, the CPU seat is cleared.
- `CpuState` lives on the room (outside `MatchState`), is created at every match start/rematch from the match seed,
  and `cpuInput` is called exactly once per confirmed frame on the pre-step state. A frame never waits on the CPU;
  it is confirmed as soon as the human input arrives (or at its deadline). Rematch needs only the human's `rematch`.
- `start.stage` for a CPU match follows the existing rule (P1's home stage).
