# 0016 - PLAT implementation notes

- Platform order in `PLATFORMS[stage]` is highest first: index 0 = HIGH, 1 = LOW left, 2 = LOW right. `Fighter.platform` indexes it.
- Constants hardcoded in `platforms.ts` (`PLATFORM_MIN_APEX` 11760, `PLATFORM_LOW` 6400, `PLATFORM_HIGH` 12300); the unit test re-derives them from a sim run. HIGH (123 px) is above the lowest single-jump apex (chompa, 117.6 px), as the slice formula dictates, so it needs a double jump for the weakest jumpers; the spec formula was followed.
- Edge fall (`edgeFall`) runs once per step after `pushboxes`, so pushes and walls can also drop a fighter. Only neutral states (idle/walk/crouch/land/dash/getup) switch to `air`; hitstun, blockstun, attack and knockdown keep their state and just become airborne.
- Pushbox gate is now `|dy| < AIR_PUSH_DY` for everyone (old behaviour was identical for same-level grounded fighters, dy = 0); needed so a fighter on a platform does not push one beneath it.
- Drop-through: two DOWN press edges within `DROP_TAP_FRAMES` (12), checked in `actionable` (a move request wins first). Sets `dropTimer = DROP_FRAMES` (10), `vy = DROP_VY` (-100). `dropTimer` ticks every frame in `physics`.
- Landing resets `vx` to 0 on platforms exactly like the ground. Throw range is not gated by height (outside the slice).
- CPU: jumps (UP) when the opponent stands on a platform above and within 120 px; drops (down, down) when it stands on a platform and the grounded opponent is over 150 px away.
- Camera y follows the mid height of both fighters (`mid - 60`) clamped to [0, 40] so the ground stays on screen. Shadows sit on the platform a fighter stands on. `drawPlatforms` is called from `AppFlow.drawScene` only (not VS/Results backdrops).
- Protocol `FighterSchema` gained `platform` (int >= -1) and `dropTimer` (>= 0).
- Golden hashes: none are committed in the repo; determinism and rollback suites passed unchanged, nothing regenerated.
