# 0012 — Graphics overhaul (GFX)

Owner request (pre-approved): a cohesive, more polished look for characters, FX, HUD, stages and menus. All art stays generated in code; no assets, no new dependencies; sim untouched (render reads state only).

Decisions:
- **Shared shading model.** `capsule()` draws outline, base, a shadow band and a rim-light band; outlined `oval()`s get a three-tone cel shade. Every skin (humans, Chompa, Bao) goes through the same helpers, so linework (`LINE = 2`) and lighting match across the cast. `mix/shade/light` now return hex and are memoised, which also fixes hit-flash tinting of back limbs (it silently skipped `rgb()` strings before).
- **Faces.** One shared `eye()` (white, pupil, highlight) with moods `normal | hurt | fierce` from `moodFor(state)`; Kaze keeps his eye slit. Looks per characters.md are unchanged.
- **Motion.** Pose blends use smoothstep (`ease`) instead of linear (spec §9.3 said "linearly"; this deviation is intentional and render-only). `squashFor()` adds render-only squash/stretch on hit, block, landing, jump squat and rise. Ground shadows under fighters.
- **FX.** `render/Projectiles.ts` draws per-kind visuals (rivet, spark, egg + explosion, shuriken, lightning column, jade dragon) using cached glow sprites. Hit sparks are tapered spikes + a 4-point star (same particle count as before: 6/8/10 + 1); block adds a guard shield; super uses a slanted accent cut-in band with the attacker's portrait; K.O. adds a pre-rendered vignette. The sim is not slowed — "slow-down" is visual only.
- **HUD.** Gradient bars (cached per context), damage trail, low-health (≤25 %) pulse, character-colour name tags, star round pips, timer plate, 4-segment super meter labelled `SUPER n/4`.
- **Stages.** Rooftop sky now runs plum overhead → `#ff9a5a` at the horizon (spec colours, direction flipped for a sunset); sun, clouds, two skyline depths, beacons, lattice crane, parapet. **Helipad arc + "H" removed** (sat under the meters). Bamboo gains sun rays, mist bands, a far bamboo layer, leaves; volcano gains smoke, lava streams, a ridge, leafy ferns, glowing cracks. Floors use converging seams for depth.
- **Performance.** A full-screen vignette pass was tried and removed: under 4× CPU throttling in headless Chromium it took frames from 16.7 ms to ~22 ms. Without it, frame pacing matches the pre-GFX baseline (16.67 ms avg). Gradients/glows are cached; no per-frame gradient creation in stages/HUD/projectiles.
- **Menus.** Title shows the cast flanking the menu; VS uses split accent panels and bigger puppets; results spotlight the winner; character-select portraits get accent backdrops and stat bars show `n/5`. Copy unchanged.
- Dev hook `window.__kb.start(mode, chars, stage?)` takes an optional stage (screenshots).
