# 0014 — v2: performance, one-button controls, platforms, effects

Owner request 2026-11-05 (pre-approved): the game must feel smooth, look juicy, gain
platforms, and every action must be one button (optionally + direction or a two-button
chord). No motion inputs for players. Super is one button and fills faster.

Inspiration (mechanics only, nothing copied): one-button "modern" special schemes in recent
fighting games (button + direction = special), platform fighters (one-way platforms,
drop-through), and "game feel" practice (hitstop, shake, particles, trails, slow-mo KO).

Decisions:
- **Slices, in order:** PERF → CTRL → PLAT → FX → TUNE. One per session (AGENTS.md).
- **Specials stay macro-driven.** The sim keeps its motion parser (no input-byte or protocol
  change). The client's `MacroPlayer` turns `SP + direction` into the motion bytes, as touch
  already does since S14. Keyboard and gamepad get the same SP path. Limit: a 3–7 frame macro
  delay; accepted. `// TODO(sim-sp-bit)` if testers feel the delay: move SP into the sim.
- **Super = one button** (`SU`) on keyboard, touch and gamepad. Plays `buildSuper` only when
  the meter is full; otherwise ignored. The double-SP super gesture is removed.
- **Meter gain ×1.5:** `METER_ON_WHIFF_SPECIAL` 10→15, `METER_DEFENDER_PERCENT` 40→60, and the
  attacker's meter gain per hit ×3/2 (via `idiv(x*3,2)`) wherever `addMeter` is called for the attacker.
- **Platforms are sim data** (deterministic, integers), one-way, drop-through with a down double-tap.
- **Players no longer see motion notation** in How to Play / Training. They see `SP`, `←SP`, `↑SP`, `↓SP`, `SUPER`.
