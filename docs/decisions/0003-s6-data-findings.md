# 0003: S6 data findings

Status: ACCEPTED (2026-11-04). Source: S6 notes in `docs/tasks.md` and `docs/test-results/S6.md`.

1. **Rising specials vs grounded opponents** (`jackhammerRise`, `liveWireHop`, `risingCrane`): later hits whiffing a grounded opponent is **intended**. These are anti-air specials; full listed damage applies only to airborne targets. Tests should assert this, and the balance-test damage totals use an airborne target.
2. **`hardHatHop` misses crouchers: bug.** An overhead must hit crouching opponents. New box `0,-40,55,50` (reaches 40 px below the feet while descending), active frames unchanged. Implemented in S7.
3. **Multi-hit projectiles losing hits to hitstop (`jadeDragon` 4/5, `staticSpark`): bug.** A projectile with `hits > 1` freezes (no movement, no life/cooldown countdown) while its current target is in hitstop caused by it. Single-hit projectiles keep moving. Replaces the last sentence of spec §8.4. Implemented in S7.
4. **Combo scaling on supers:** every hit of a super uses the scaling percentage of its **first** hit (a super started fresh is unscaled for all its hits; a super cancelled from a 3-hit combo is 70% for all its hits). Implemented in S7.
