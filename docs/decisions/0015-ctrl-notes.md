# 0015 - CTRL implementation notes

- Edge reporting: `Keyboard` and `Gamepad` expose `takeEdges()`, `Touch` exposes `takeEdges()`/`read()`; `AppFlow.readInputs` owns two `MacroPlayer`s (one per local player) so every source shares one player. Online the local player is always slot 0.
- `SP`/`SU` are in `ACTIONS` with sim bit 0 (client-only), so rebinding, swap and storage migration reuse the existing code. Stored maps lacking them fall back to defaults in `parseSettings`.
- Meter: decision 0014 only lists `hit.ts`; the same two `addMeter` pairs in `projectile.ts` also changed (x3/4 block, x3/2 hit) so projectiles match "wherever addMeter is called for the attacker". Defender share changes via `METER_DEFENDER_PERCENT`. `fighter.ts` whiff gain is via the constant.
- Golden hashes: no committed golden hash needed regenerating; the determinism suite passed unchanged. Existing sim-combo meter expectations were updated (30/18, block 15/0).
- Gamepad buttons: RB = index 5, RT = index 7 (standard mapping).
- Touch SUPER sits at dx 162 / dy 220 (64 px left of SP). Old stored touch layouts without `SU` fail `parseLayout` and fall back to the default layout.
- Touch SP label is a CSS `::after` from `data-label`, updated per rendered frame by `Touch.refresh()`. `spLabel` helper in Macro.ts is available; Touch uses `macroEntry` + a name callback.
- `notation()` stays exported in HowToPlay.ts (tested) but is no longer shown; Moves tab lists SP rows.
- Stale `DOUBLE_SP_FRAMES` removed.
