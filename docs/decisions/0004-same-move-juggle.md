# 0004: Same-move hits continue a juggle

Status: ACCEPTED (2026-11-04). Source: S7 BLOCKED question in `docs/tasks.md`.

**Rule:** on a juggled fighter, a hit without `launch` still connects if it comes from the same move instance that already hit (the attacker's `moveHitMask` is non-zero). This amends spec §8.3, rule 6. Code: `detect()` in `packages/shared/src/sim/hit.ts`.

**Measured outcome:** `liveWireHop` against an airborne target lands 3 of its 4 hits (30 + 30 + 24 with combo scaling = **84**). Volt rises faster than a juggled target, so the 4th hit passes overhead. The listed 4 × 30 applies only when the target stays close (for example near a wall). Retuning this is left to the balance/polish pass (S15), which should use frame traces rather than guessing. `tests/unit/balance.test.ts` asserts 84.

**Also fixed:** in `toJuggle()`, a trailing comment swallowed the reset of `stun`, `pushRemain`, `pushPerFrame` and `lockLeft`, so launched fighters could keep stale pushback or lock state. The reset now runs.
