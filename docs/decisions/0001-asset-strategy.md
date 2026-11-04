# 0001 — Asset strategy: procedural puppet characters, no downloaded sprites

Status: ACCEPTED (2026-11-04)

## Context
`Archive/` holds packs the owner downloaded. Review on 2026-11-04:

| File | Content | Licence found | Verdict |
|---|---|---|---|
| `FighterAnimsHD&Pixel.zip` | One rotoscoped human, 4x4 frame grids, 256px cells, ~45 anims | none in archive | Style mismatch; no licence |
| `Petey Panda.zip` | 64px chibi purple panda, 12 anims (no kicks) | none in archive | Too small, no kicks; no licence |
| `Panda Hero 1_0.zip`, `Panda Hero + Controller.unitypackage` | Unreal `.uasset` / Unity package | none | Not usable in a web build |
| `Ninja 10KStudios png files.zip` | 165px white silhouette ninja, 6 anims | none | Silhouette style, no kicks/blocks |
| `Free Pack (3 Creatures).zip` | 64px quadruped dinos (Polar Harbor) | permissive, no redistribution as pack | Quadrupeds cannot perform fighter moves |
| `Game Boy Advance - Mario & Luigi ...png` (2) | Ripped Nintendo sprites | none (copyrighted) | **Forbidden. Never copy into the repo.** |

Five creators, four scales, no shared animation set: no coherent roster is possible.

## Decision
1. All fighters, effects, stages and UI art are **generated in code** at runtime (Canvas 2D puppet rig, `docs/spec.md` §9).
2. `Archive/` is git-ignored and never imported, bundled, or referenced by code.
3. Characters are original designs (`docs/characters.md`). No Nintendo, Capcom or DreamWorks names, likenesses, outfits, logos, sounds or move names.
4. A future art swap may replace a puppet with a licensed sprite sheet only through a new decision record that names the licence and adds a row to `assets/provenance.csv`.
