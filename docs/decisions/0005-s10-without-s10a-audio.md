# 0005: S10 ships visuals; audio wiring moves to S10a

Status: ACCEPTED (2026-11-04, owner pre-approved 2026-11-04). Source: S10 run while S10a is still BLOCKED.

**Problem:** S10 lists S10a as a prerequisite and asks it to "consume S10a audio APIs", but S10a is not implemented (its copy-contract question is open), so there is no audio API to wire.

**Rule:** S10 is complete with FX, HUD and stages. Wiring audio into the presentation layer (`apps/client/src/app/AppFlow.ts`, marked `TODO(S10a)`) becomes part of S10a's scope. S10a must play sounds from `state.events` inside `AppFlow.advance()` next to `fx.consume()`, so it reuses the same once-per-frame guard (`Fx.lastFxFrame`), and must unlock audio on the first user gesture.

**Also decided:** the playable view now draws stage + puppets + FX + HUD by default; F1 switches to the S8 debug view (hitboxes). Fx/Hud timers advance once per simulated frame (fixed 1/60 s), not per animation frame. Hit flash is shown for the first 2 frames of hitstun/juggle; the red counter flash on the puppet is not shown (only the COUNTER ring + text), because the sim exposes no per-fighter counter flag.
