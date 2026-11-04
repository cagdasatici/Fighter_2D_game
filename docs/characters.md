# Knockout Bash — Roster, frame data, visuals

Five **original** characters. The owner's brief named famous characters only as *archetypes* (a hard-working everyman, his lanky partner, a dino, a ninja, a kung-fu bear). Designs below must stay clearly distinct from any existing franchise: **no red caps with letter emblems, no moustache + overalls combo, no green saddle-dinos, no black-and-white panda.** Executors must not "improve resemblance" to any real character.

Units: damage in HP points (fighters have ~1000), boxes in px local space (§6 of spec: x forward from feet centre, y up, `{x,y,w,h}` = bottom-left + size), velocities in units/frame (100 units = 1 px).

---

## 1. Base normals (`packages/shared/src/chars/base.ts`)

Every character starts from these 13 templates, then applies the overrides listed in its own section. `cancel` S = special+super, C = chain (same button repeats), — = none. Hitstop: light 8, heavy 11. `meterOnHit`: light 20, heavy 40.

| id | input | startup | active | recovery | dmg | chip | hitstun | blockstun | level | box `{x,y,w,h}` | pushback | KD | cancel | pose | hurtExtend |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `5LP` | stand LP | 4 | 2 | 7 | 30 | 0 | 12 | 9 | mid | 20,72,40,16 | 900 | no | S,C | jab | 20,70,30,20 |
| `5HP` | stand HP | 7 | 3 | 18 | 80 | 8 | 19 | 15 | mid | 20,66,52,22 | 1600 | no | S | strong | 20,64,45,26 |
| `5LK` | stand LK | 5 | 3 | 9 | 35 | 0 | 13 | 10 | mid | 15,36,50,18 | 1000 | no | — | lowKick | 15,30,40,24 |
| `5HK` | stand HK | 9 | 3 | 20 | 85 | 8 | 20 | 16 | mid | 20,58,60,22 | 1800 | no | — | roundhouse | 20,50,55,30 |
| `2LP` | crouch LP | 4 | 2 | 7 | 25 | 0 | 11 | 9 | mid | 15,44,43,14 | 900 | no | S,C | crJab | 15,40,35,20 |
| `2HP` | crouch HP | 6 | 4 | 20 | 75 | 7 | 19 | 15 | mid | 0,50,50,70 | 1400 | no | S | uppercut | 0,50,40,60 |
| `2LK` | crouch LK | 5 | 2 | 10 | 25 | 0 | 11 | 9 | **low** | 20,0,50,16 | 900 | no | S | crShort | 20,0,40,18 |
| `2HK` | crouch HK | 9 | 3 | 22 | 75 | 7 | — | 14 | **low** | 20,0,70,14 | 1200 | **yes** | — | sweep | 20,0,60,18 |
| `j.LP` | air LP | 4 | 8 | 0 | 40 | 4 | 12 | 9 | mid | 10,30,35,20 | 800 | no | — | airPunch | — |
| `j.HP` | air HP | 7 | 5 | 0 | 80 | 8 | 18 | 14 | mid | 10,10,50,30 | 1200 | no | — | airHeavy | — |
| `j.LK` | air LK | 5 | 8 | 0 | 40 | 4 | 12 | 9 | mid | 10,10,45,24 | 800 | no | — | airKick | — |
| `j.HK` | air HK | 8 | 5 | 0 | 85 | 8 | 18 | 14 | mid | 15,15,55,22 | 1300 | no | — | airKick | — |
| `throw` | LP+LK (close) | 5 | 1 | 22 | 120 | — | — | — | — | range 70 px | — | yes | — | throwGrab/throwToss | — |

**Special defaults:** any special/super field not listed uses: blockstun 16, chip = 10% of damage (integer), hitstop 11, pushback 1500, meterOnHit 30, level mid, knockdown false.

Jump attacks: `landingRecovery` = 4 (spec `LANDING_RECOVERY_ATTACK`). 2HK `hitstun` is irrelevant (always knockdown).

Default character physics (overridden per char): `walkFwd 350`, `walkBack 280`, `jumpVy 1650`, `jumpVx 380`, `dashFwd {frames 16, speed 900}`, `dashBack {frames 20, speed 850, invuln 8}`, `pushWidth 40`, hurt `stand {-22,0,44,110}`, `crouch {-24,0,48,70}`, `air {-20,10,40,90}`.

**Universal command normal** (one per character, listed in its section) and **SP macro table** (touch easy-special) are per character.

---

## 2. Bolt Brickley — "The Riveter" (all-rounder)

**Concept:** a cheerful construction worker who fights with riveting tools and hard-hat headbutts. Short, stocky, fearless.

**Look / skin (`render/skins/bolt.ts`):**
- Hard hat: yellow `#ffcc1a` dome with a brim and a small orange warning lamp on top (blinks 1 Hz when meter full).
- Hi-vis vest: orange `#ff7b1c` with two silver `#e0e0e0` reflective stripes over a grey `#5d6670` long-sleeve shirt (sleeves rolled: forearms skin `#e8a87c`).
- Cargo trousers olive `#6b6b3a`, heavy brown boots `#4a2f1b`, tool belt (tan band with 3 small rectangles at the hip).
- Face: round, big eyebrows, short **stubble beard** (dark dots), no moustache. Gloves: thick grey `#9aa3ad`.
- Proportions: torso 34, head r 15, uArm 20, fArm 18, thigh 22, shin 22, hipHeight 44. Widths: torso 30, arms 11, legs 13.

**Physics:** hp 1000, defaults.

**Normals overrides:** `5HP` pose `strong`, VFX small orange spark on hit ("wrench swing"): box `20,64,56,24`. Command normal **Hat Butt** `6+HP`: startup 18, active 3, recovery 14, dmg 60, **overhead**, hitstun 16, blockstun 12, box `15,70,40,30`, pose `strong` with torso 50 / head 20 at active, cancel —.

**Specials:**
| id | input | startup | active | recovery | dmg | chip | stun hit/block | details |
|---|---|---|---|---|---|---|---|---|
| `rivetShot` | QCF+P | 12 | — | 30 | 70 | 10 | 18 / 14 | projectile `rivet`: spawn f12 offset (50,70), vx LP 450 / HP 650, w 20 h 10, life 120, 1 hit, hitstop 8, pushback 1200, meterOnHit 30. Pose `castWind`→`cast`. |
| `jackhammerRise` | DP+P | 3 | 12 | 24 (+ landingRecovery 10) | LP 110 / HP 140 | 15 | KD | invuln full f1-6 (HP version f1-8). Velocities f3: vx 150 vy 1500 (HP vy 1800). 2 hits: f4-6 box 10,40,40,60 dmg 60 (no KD, hitstun 30), f7-15 box 5,60,40,60 dmg rest, launch vx 200 vy 1200. airborne f3-end. pose `rise`. VFX: grey dust ring at feet f3, rapid vertical speed lines. |
| `hardHatHop` | QCB+K | 14 | 6 | 16 (+lr 6) | 90 | 10 | KD on air hit, else hitstun 20 / bs 14 | **overhead**. Velocities f1: vx LK 300 / HK 500, vy 1400. airborne f1-end. Hit f15-20 box -10,-10,50,30 (headfirst dive). pose `jumpTuck` → torso 120 (dive). VFX: hard-hat lamp streak. |

**Super — `demolitionDrive`** (QCF QCF + P), cost 1000: startup 4 (after freeze), active 20, recovery 30. Velocities f4: vx 1100. On first hit (box 10,30,50,70, f5-24) the fighter stops (`vx=0`) and the move runs 4 hits at f+0,+6,+12,+18 each dmg 50, then the final hit at f+24 dmg 130 with launch vx 400 vy 1500. Total 330 unscaled. Invuln strike f1-10. If the first hit is blocked: chip 15 per hit, blockstun 20, ends early. VFX: per hit a jackhammer "brrt" (white zigzag), final hit orange explosion circle radius 50 + 12 debris rectangles.

**SP macros (touch):** neutral → `rivetShot` HP; up → `jackhammerRise` HP; back → `hardHatHop` HK; down → `rivetShot` LP (slow); double-SP → super.

**Bot style:** balanced; anti-airs with `jackhammerRise`.

---

## 3. Volt Vance — "The Live Wire" (zoner)

**Concept:** Bolt's tall, jittery work partner, an electrician who is afraid of everything except electricity. Keeps opponents away with slow sparks and a cable whip.

**Look / skin:**
- Tall and thin. Teal `#1fa39a` work jumpsuit with a white collar, a **yellow lightning bolt patch** on the shoulder (a plain zigzag, no letters).
- Big round welding goggles pushed up on the forehead (two grey circles with blue lenses `#7fd4ff`), messy blue-black hair `#24324a` tufts (3 triangles).
- Rubber gloves bright yellow `#ffe14d`, boots black. A coiled orange cable `#ff8c1a` loops on the back hip (drawn as 3 overlapping ellipse outlines).
- Face: long, worried eyebrows (angled up in the middle), small mouth.
- Proportions: torso 40, head r 13, uArm 24, fArm 22, thigh 28, shin 28, hipHeight 56. Widths: torso 22, arms 9, legs 10.

**Physics:** hp 950, walkFwd 320, walkBack 300, jumpVy 1750 (floaty: gravity is global, so he just goes higher), jumpVx 360. hurt stand `{-20,0,40,124}`, crouch `{-22,0,44,76}`.

**Normals overrides:** reach +12 px on `5HK`, `2HK`, `5HP` (add 12 to `w`), recovery +2 on each of those. `j.HK` ("flutter kick"): active 8, `gravityScale` 50 (physics uses `idiv(GRAVITY*gravityScale,100)`). Command normal **Shock Toe** `3+LK`: low slide, startup 8, active 6, recovery 18, dmg 50, low, box 25,0,60,14, velocities f1 vx 700, f14 vx 0, KD no, cancel S.

**Specials:**
| id | input | startup | active | recovery | dmg | details |
|---|---|---|---|---|---|---|
| `staticSpark` | QCF+P | 14 | — | 28 | 60 (chip 10) | projectile `spark`: green-yellow ball w 26 h 26, offset (45,70), vx LP 250 / HP 420, life 180, **hits 2**, hitInterval 10, hitstun 16, blockstun 12, pushback 900, meterOnHit 25. Wobble render only (sin y ±3 px). |
| `coilWhip` | QCB+P | 11 | 4 | 22 | 80 (chip 8) | long-reach lash: box LP `40,60,110,14`, HP `40,60,140,14` (HP startup 14). hitstun 20 / bs 15, pushback 1600. hurtExtend `40,60,90,14`. VFX: orange bezier cable from fist to box end, crackle sparks at tip. |
| `liveWireHop` | DP+K | 5 | 18 | 20 (+lr 12) | 4 hits × 30 | invuln strike f1-7. velocities f5 vx 100 vy 1500. Hits every 4 frames f6-21 box 0,40,45,70, last hit launch vx 150 vy 1000. Blue electric aura on the puppet during active. |

**Super — `overload`** (QCF QCF + P): startup 10, recovery 40. At f10, f18, f26, f34, f42 spawns a **lightning column** projectile (w 40, h 360, vx 0, life 8, 1 hit, dmg 70, chip 12, hitstun 30, unblockable? **no** — blockable mid, blockstun 18) at world x = owner.x + facing × {80, 180, 280, 380, 480} px, y 0. Total 350 if all hit. VFX: each column = white core 6 px + yellow jagged polyline (8 segments, jitter seeded from frame) + ground flash circle.

**SP macros:** neutral → `staticSpark` HP; up → `liveWireHop` HK; back → `coilWhip` HP; down → `staticSpark` LP; double-SP → super.

**Bot style:** keepaway, prefers distance 260–400 px.

---

## 4. Chompa — "The Hungry Dino" (grappler)

**Concept:** a stubby, always-hungry bipedal dinosaur who swallows opponents and spits them out. Huge jaw, tiny arms, powerful tail.

**Look / skin:**
- Plum-maroon body `#8c2f5a`, cream belly plate `#f3d9a4` with horizontal segment lines, **three yellow-orange back spikes** `#ffb02e` from head to tail, short stubby tail drawn as a tapered capsule (bone `tail`, length 40, width 18→6).
- Head: big oval, length 34, with a wide jaw (lower jaw is its own bone `jaw`, angle 0 closed / 35 open) and two small round nostrils; small angry-cute eyes with a single highlight.
- Arms are tiny (uArm 12, fArm 10, width 8) with 3 claw nubs. Legs thick (thigh 18, shin 16, width 16) with wide 3-toe feet.
- No saddle, no shoes, no shell, no boots.
- Proportions: torso 36 (tilted forward by default +20), hipHeight 34, root width 34.

**Physics:** hp 1100, walkFwd 280, walkBack 220, jumpVy 1500, jumpVx 340, dashFwd {frames 20, speed 800}, pushWidth 50, hurt stand `{-26,0,52,104}`, crouch `{-28,0,56,70}`, air `{-24,10,48,84}`.

**Normals overrides:** punches become bites: `5LP` box `20,70,38,18` (jaw opens 35 at active); `5HP` "Chomp" startup 8, dmg 95, box `20,60,48,30`. `5HK` = tail whip: pose spins torso 160 so the tail faces forward; box `10,30,70,24`, recovery 22. `2HK` = tail sweep box `10,0,80,14`. Command normal **Belly Bounce** `6+HK`: startup 12, active 4, recovery 16, dmg 70, mid, pushback 2600 (big push), box `10,30,40,50`.

**Specials:**
| id | input | startup | active | recovery | dmg | details |
|---|---|---|---|---|---|---|
| `gulpGrab` | 360+P | 5 | 2 | 34 (whiff) | LP 200 / HP 240 | command grab, range LP 80 px / HP 65 px, unteachable. On grab: 50-frame animation (opponent hidden "inside" the puppet: render the victim scaled 0 and Chompa's belly bulges 1.3× for frames 10-35), then spit: victim launched vx 900 vy 1200 → knockdown. Damage applied on spit frame. Event `throw` strength 2. |
| `eggLob` | QCB+P | 16 | — | 26 | 80 (chip 10) | projectile `egg`: offset (20,90), vx LP 300 / HP 520, vy 1200, gravity 70, w 20 h 24, explodeOnGround (explosion 80×60 px, 20 frames, 1 hit), on direct hit also explodes. KD on hit. Egg render: white oval with 4 random-but-seeded purple spots. |
| `tailSpin` | charge back → forward + K | 6 | 24 | 18 | 3 hits × 35 | moves forward vx LK 600 / HK 850 for f6-29, box -30,10,90,50 (hits both sides), hits at f8, f16, f24, last hit KD. Invuln projectile f1-29. pose `spin` (whole puppet rotates 360° every 8 frames, render-only). |

**Super — `stampedeRoll`** (QCF QCF + K): curls into a ball and rolls across the screen. startup 6, active 50, recovery 30. vx 1300; rebounds once off the wall (vx reverses at wall contact, facing unchanged). Box -30,0,60,60, hits every 6 frames (max 6 hits) × 55 dmg, chip 10 each. Invuln strike f1-12. Ends early when 6 hits land; final hit launch vx 500 vy 1400. VFX: dust trail every 3 frames, rotating spike silhouettes.

**SP macros:** neutral → `eggLob` HP; up → `gulpGrab` HP (macro emits 6,3,2,1,4,7,8 then HP; jump is cancelled by spec §5.3); back → `eggLob` LP; down → `tailSpin` HK if charged ≥40 else `gulpGrab` LP; double-SP → super.

**Bot style:** walks forward, uses `gulpGrab` at < 80 px 35% of the time.

---

## 5. Kaze — "The Shadow Step" (rushdown)

**Concept:** a quiet, fast ninja who never stops moving: fast pokes, teleports and multi-shuriken pressure.

**Look / skin:**
- Deep indigo `#2b2d6e` wrap suit, charcoal `#1b1b2a` mask covering the lower face, a long **red scarf** `#e63946` that trails behind (extra bone chain `scarf1..scarf4`, each 12 px; render-only physics: each segment angle lerps toward the previous segment's angle + (vx-based drag), simple spring, deterministic per frame).
- Silver forehead plate with a **simple wind swirl** mark (a spiral of 1.5 turns), straw-coloured wrist and shin wraps `#d8c99b`.
- Bare feet in split-toe socks (dark grey). Visible eyes: sharp white slits.
- Proportions: torso 34, head r 13, uArm 21, fArm 19, thigh 25, shin 25, hipHeight 50. Widths: torso 20, arms 9, legs 10.

**Physics:** hp 900, walkFwd 420, walkBack 330, jumpVy 1700, jumpVx 460, dashFwd {frames 12, speed 1200}, dashBack {frames 16, speed 1000, invuln 10}. **Double jump:** one extra jump in air (input 7/8/9 pressed while airborne, after vy < 600): sets vy 1400, vx by direction ×0.9. Add `airJumps: number` to Fighter (reset on landing) and `airJumpMax` to CharDef (default 0, Kaze 1).

**Normals overrides:** all light normals startup 3; `5LP`/`2LP` recovery 6; damage −5 on every normal; `5HK` = spinning back-kick startup 8. Command normal **Cartwheel Kick** `6+LK`: startup 14, overhead, active 4, recovery 12, dmg 55, velocities f1 vx 500, f14 vx 0, box 10,40,40,40.

**Specials:**
| id | input | startup | active | recovery | dmg | details |
|---|---|---|---|---|---|---|
| `shurikenFan` | QCF+P (ground or air) | 10 | — | 28 (air: until landing, lr 4) | 40 each | LP: 1 star vx 800. HP: 2 stars, second spawned 4 frames later, offsets (40,80) and (40,60). Air version (`stance: air`, separate move id `airShuriken`): vx 700 vy −500 (downward diagonal). Star: w 16 h 16, life 90, hitstun 12, blockstun 10, chip 6, meterOnHit 15. Render: 4-point star spinning 30°/frame, silver. |
| `smokeStep` | ↓↓+K | 4 | — | 14 | — | teleport: f1-16 invuln full, puppet hidden f5-14 with a purple-grey smoke puff (12 circles). At f10 set x = opponent.x − 60 px × opponent.facing (behind opponent) if LK, or x = opponent.x + 120 px × opponent.facing (in front) if HK; clamp to walls; facing updates at f15. |
| `risingCrane` | DP+K | 4 | 10 | 22 (+lr 10) | LK 100 / HK 130 | invuln full f1-5 (HK f1-7). velocities f4 vx 250 vy 1600. 2 hits: f5-7 dmg 40, f8-14 rest, launch vx 250 vy 1300. Pose: one-leg rising knee then extended kick (thighF 60, shinF 0). VFX: white crescent arc behind the foot. |

**Super — `thousandShadows`** (QCF QCF + P): dash vx 1600 f4-20, first hit box 10,20,50,90. On hit: screen-tinted purple, both fighters' sim positions locked; 8 hits over 48 frames (every 6 frames, 30 dmg each) where render draws 3 translucent afterimage clones attacking from alternating sides; final hit dmg 100, launch vx 300 vy 1600. Total 340. Invuln full f1-6. Whiff recovery 34.

**SP macros:** neutral → `shurikenFan` HP (air: `airShuriken`); up → `risingCrane` HK; back → `smokeStep` LK; down → `smokeStep` HK; double-SP → super.

**Bot style:** aggressive, dashes in, mixes `6LK` overhead and `2LK` low.

---

## 6. Bao — "The Dumpling Master" (heavy with a counter)

**Concept:** a big, cheerful brown bear kung-fu master who runs a dumpling stall. Deceptively quick, powerful palms, a counter stance and a healing super.

**Look / skin:**
- **Brown** bear `#8a5a32` (not black-and-white), lighter muzzle and belly `#d9b38c`, small round ears, black nose, friendly eyes with thick eyebrows.
- Sleeveless **forest-green** `#2f6b3a` kung-fu vest with gold `#e2b53c` knot buttons, wide **white** sash `#f4f1e8`, grey `#6e6a64` loose trousers wrapped at the ankle, cloth shoes.
- A small bamboo steamer basket hangs from the sash on the back hip (tan cylinder with 2 lines).
- Round body: torso drawn as an ellipse 44×52, belly ellipse overlay.
- Proportions: torso 36, head r 17, uArm 20, fArm 18, thigh 20, shin 18, hipHeight 40. Widths: torso 40, arms 14, legs 15.

**Physics:** hp 1100, walkFwd 300, walkBack 250, jumpVy 1550, jumpVx 340, pushWidth 52, hurt stand `{-28,0,56,108}`, crouch `{-30,0,60,72}`, air `{-26,10,52,86}`.

**Normals overrides:** `5HP` = open palm startup 8 dmg 90, pushback 2200; `2HP` = belly bump box `0,40,50,60`; `5HK` startup 11 dmg 95. Command normal **Belly Bounce Down** `3+HP`: startup 16, active 3, recovery 16, dmg 70, **overhead**, pose = small hop (velocities f1 vy 900, airborne f1-14, landingRecovery 0). Box `0,0,60,40`.

**Specials:**
| id | input | startup | active | recovery | dmg | details |
|---|---|---|---|---|---|---|
| `jadePalm` | QCF+P | 13 | 4 | 24 | LP 100 / HP 130 (chip 15) | short-range energy blast: box LP `30,50,70,40`, HP `30,45,100,50` (HP startup 16). hitstun 22, blockstun 16, pushback 2500, KD on HP. Not a projectile (can't be clashed). VFX: jade `#3ddc97` circle that expands from the palm 20→60 px and fades, 6 leaf-shaped sparks. |
| `rollingBun` | charge back → forward + P | 8 | 30 | 16 | LP 90 / HP 110 | ball roll: velocities f8 vx LP 900 / HP 1200; box -20,0,60,60; one hit, KD. Invuln projectile f1-38. Stops at wall. pose `spin`. |
| `bambooCounter` | QCB+K | 3 | 18 (stance) | 22 (whiff) | counter 130 | stance f4-21: `counter: {from:4,to:21,damage:130}`. If struck by a non-throw strike/projectile in the window → parry (spec §8.3 rule 6): Bao plays a palm-strike response (8 frames), attacker takes 130 and is launched. Low attacks are **not** countered by LK version, overheads **not** countered by HK version (LK = high counter, HK = low counter). |

**Super — `dragonDumpling`** (QCF QCF + P): eats a dumpling (heal 80 on f10, can't exceed max hp), then at f30 fires `jadeDragon` projectile: w 90 h 70, vx 900, life 90, 5 hits every 4 frames × 50 dmg (last hit launch), chip 10 each, blockstun 20. Invuln strike f1-30 (the eating window is safe). Recovery 34. Total damage 250 + heal 80. VFX: jade serpent: head circle + 6 trailing circles following the head with a 3-frame delay each, gold whiskers lines, sparkle trail.

**SP macros:** neutral → `jadePalm` HP; up → `bambooCounter` LK (high); back → `bambooCounter` HK (low); down → `rollingBun` HP if charged else `jadePalm` LP; double-SP → super.

**Bot style:** patient, blocks a lot, uses `bambooCounter` when the opponent's jump-in is predicted (30%).

---

## 7. Character select stats (display only)

| Char | Power | Speed | Range | Tag |
|---|---|---|---|---|
| Bolt | 3 | 3 | 3 | All-rounder |
| Volt | 2 | 3 | 5 | Zoner |
| Chompa | 5 | 1 | 2 | Grappler |
| Kaze | 2 | 5 | 2 | Rushdown |
| Bao | 4 | 2 | 3 | Counter-heavy |

## 8. Home stages
Bolt, Volt → `rooftop`; Kaze, Bao → `bamboo`; Chompa → `volcano`.

## 9. Balance guardrails (tests in slice S7 assert these from data)
1. Every `5LP` is +1 to +3 on block, every `5HP`/`5HK`/`2HK` is −3 to −12 on block (blockstun − (remaining active − 1 + recovery)).
2. Every DP-style special (`jackhammerRise`, `liveWireHop`, `risingCrane`) is ≤ −20 on block.
3. Every projectile special has total frames ≥ 38 (prevents projectile walls).
4. Every super's unscaled total damage is 250–360.
5. No normal has startup < 3; no non-throw move has active > 30 except `stampedeRoll` (50) and counter stances.
