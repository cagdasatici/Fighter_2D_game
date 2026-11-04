# 0006: S10a adapts the copied AudioBus/synth and wires audio into AppFlow

Status: ACCEPTED (owner pre-approved 2026-11-04). Answers the S10a BLOCKED copy-contract question.

**Rule:** `apps/client/src/audio/AudioBus.ts` and `synth.ts` are copied from `../battlegrounds_game` and adapted
(spec §13 "unchanged" is overridden): sound keys become the Knockout Bash §13 keys, and the single ambient music
buffer becomes one procedural four-bar loop per stage (`music.ts`). The 16-voice cap, priority stealing, compressor
+ effects gain, linear attenuation, suspend/resume/ensureRunning and dispose behavior are kept. Channelled
"loop bed" APIs (`startLoop`, `setLoopDistance`, `LOOPS`) are removed as unused.

**Also decided (S10a session, no owner question needed):**
- Music API: `setStage(stage|null)`, `setMusicVolume(0..1)` (default 0.25), `setMusicEnabled(bool)` for S11 Settings.
- AppFlow plays SFX before `fx.consume()` only when `state.frame !== fx.lastFxFrame` (same once-per-frame guard,
  decision 0005). The stage loop plays in phases intro/fight/roundEnd and stops at matchEnd.
- The sim never emits `whiff`, `land` or `special` events and has no jump event, so `sfx.ts` derives cues from the
  previous/current state: jumpSquat→air = jump, entering land = land, entering attack = whiff swing, a newly
  spawned projectile = its per-kind sound. The sim is not changed.
- `lightningColumn` (Volt's super projectile) has no §13 recipe; it reuses the spark sound.
- §13 "reverb tail" on super is approximated with delayed, quieter echo layers (no convolver/impulse buffer).
- Single-screen fights pass distance 0 (no attenuation). Audio unlocks on the first pointerdown/keydown; the
  gesture listeners are removed once the context runs and on dispose; page hidden → suspend, visible → resume.
