# Knockout Bash — task slices

One slice per session. Each slice: prerequisites, exact files, steps, tests (offline, vitest unless noted), STOP points, commit subject. Status values: TODO, IN PROGRESS, BLOCKED (with question), IMPLEMENTED – DEVICE CHECK PENDING, DONE.

Reference project: `../battlegrounds_game` (read-only; copy files, never edit it).

## Status ledger

| Slice | Title | Prereq | Status | Commit | Evidence |
|---|---|---|---|---|---|
| S0 | Repo scaffold + tooling | — | DONE | 9647c8d | docs/test-results/S0.md |
| S1 | Fixed math, RNG, input bytes, history | S0 | DONE | c4cd25f | docs/test-results/S1.md |
| S2 | Motion parser | S1 | DONE | a9bdd68 | docs/test-results/S2.md |
| S3 | Char data model + base normals + 5 char data files | S1 | DONE (provisional values, see S3 notes) | 371f477 | docs/test-results/S3.md |
| S4 | Sim core: state, movement, jumps, dashes, pushboxes | S2, S3 | DONE | 76b3f62 | docs/test-results/S4.md |
| S5 | Attacks, hit/block resolution, combos, throws | S4 | DONE | 8496beb | docs/test-results/S5.md |
| S6 | Projectiles, specials, special rules per char | S5 | DONE (data findings, see S6 notes) | bf79207 | docs/test-results/S6.md |
| S7 | Supers, meter, round/match flow, balance guardrails, determinism suite | S6 | DONE (liveWireHop resolved by decision 0004) | 779d930 | docs/test-results/S7.md |
| S8 | Client shell: canvas, game loop, keyboard, local 2P with debug boxes | S7 | DONE (browser verified; physical keyboard check NOT RUN) | 940b07a | docs/test-results/S8.md |
| S9 | Puppet renderer + 5 skins + pose library | S8 | DONE (art approved as placeholder 2026-11-04; polish later) | ac2f52f | docs/test-results/S9.md |
| S10 | FX, HUD, stages + audio integration | S9, S10a | DONE (audio wiring moved to S10a, decision 0005) | b41c2cb | docs/test-results/S10.md |
| S10a | Standalone synthesized audio + stage music | S0 | DONE (decision 0006) | a8ca537 | docs/test-results/S10a.md |
| S11 | Menus, char select, Versus CPU, Training, CPU AI | S10 | DONE (decision 0007; device checks NOT RUN) | ec79379 | docs/test-results/S11.md |
| S12a | Server infra copy + FightRoom placeholder (no sim) | S0 | DONE | 5f40b10 | docs/test-results/S12a.md |
| S12 | Server infrastructure + two-human input authority (S12a + S12b) | S7 | DONE | aacf6a7 | docs/test-results/S12b.md |
| S12b | Two-human input-authoritative FightRoom | S7, S12a | DONE | aacf6a7 | docs/test-results/S12b.md |
| S12c | Server CPU seats | S11, S12b | DONE | f097ce7 | docs/test-results/S12c.md |
| S13 | Client rollback netcode + online flow | S11, S12 | DONE | b828347 | docs/test-results/S13.md |
| S14 | Touch controls + gamepad + iPad PWA + play script | S13 | IMPLEMENTED – DEVICE CHECK PENDING | e1abc90 | docs/test-results/S14.md |
| S15 | Browser tests, polish pass, release checklist | S14 | IMPLEMENTED – DEVICE CHECK PENDING (decision 0011; release checklist NOT RUN) | a1428e5 | docs/test-results/S15.md |
| TXT | Text, menus, settings, admin page (owner request) | S15 | DONE (decision 0013; gamepad/iPad NOT RUN) | c6c954b | docs/test-results/TXT.md |
| PERF | Render performance (decision 0014) | TXT | DONE | 982926d | docs/test-results/PERF.md |
| SEL | 3D-style rotating character select (owner request) | PERF | DONE (owner go-ahead 2026-11-05) | d98ab49 | docs/test-results/SEL.md |
| CTRL | One-button specials + super button, faster meter | PERF | DONE | 68cdb80 | docs/test-results/CTRL.md |
| PLAT | One-way platforms in sim + stages | CTRL | DONE | fdff6a7 | docs/test-results/PLAT.md |
| FX | High-quality game-feel effects | PLAT | DONE | ce25d7c | docs/test-results/FX.md |
| TUNE | Balance + CPU for specials/platforms | FX | TODO | | docs/test-results/TUNE.md |

S12 can run in parallel with S8–S11 (different files).

---

## S0 — Repo scaffold + tooling
**Files:** root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `.node-version`, `packages/shared/{package.json,tsconfig.json,src/index.ts}`, `apps/server/{package.json,tsconfig.json,src/main.ts}`, `apps/client/{package.json,tsconfig.json,index.html,vite.config.ts,src/main.ts}`, `ops/scripts/lint-boundaries.mjs`, `ops/scripts/lint-timers.mjs`, `tests/unit/smoke.test.ts`, `docs/test-results/.gitkeep`.
**Steps:**
1. `git init` (if `.git` missing), keep the existing `.gitignore` (it ignores `Archive/`).
2. Copy the config files listed in spec §14 from `../battlegrounds_game`. Package names `knockout-bash`, `@kb/shared`, `@kb/server`, `@kb/client`.
3. Root `package.json` scripts: `typecheck: tsc -b`, `lint: node ops/scripts/lint-boundaries.mjs && node ops/scripts/lint-timers.mjs`, `test: vitest run`, `build: pnpm -r --filter ./apps/client run build`, `dev:server`, `dev:client`, `verify: pnpm typecheck && pnpm lint && pnpm test && pnpm build`. Dev deps exactly as spec §2 (no three, no rapier).
4. `apps/server/package.json` deps: `@kb/shared workspace:*`, `@colyseus/schema 5.0.43`, `@colyseus/ws-transport 0.18.4`, `colyseus 0.18.10`, `zod 4.6.7`; dev `tsx 4.23.15`. Client: `@kb/shared`, `@colyseus/sdk 0.18.9`, `zod 4.6.7`; dev `vite 8.3.5`. Shared: `zod 4.6.7`.
5. `lint-boundaries.mjs`: fail (exit 1, print file:line) if (a) any file in `packages/shared/src` imports `apps/`, `node:`, or references `document`/`window`; (b) any file under `packages/shared/src/{sim,input,chars,ai}` or `fixed.ts`/`rng.ts` matches `/Math\.(random|sin|cos|sqrt|pow|round|floor|ceil)|\bDate\b|performance\.|setTimeout|setInterval|\*\*|parseFloat|toFixed/` (ignore lines starting with `//` or ` *`); (c) any file in `apps/client/src` or `packages` imports from `../battlegrounds_game` or `Archive`.
6. `lint-timers.mjs`: copy from battlegrounds unchanged except paths.
7. Client `main.ts` draws "Knockout Bash" on a 640×360 canvas. Server `main.ts` logs "kb server stub" and exits 0.
8. `pnpm install` (Node 24: `export PATH="$HOME/.local/node24/bin:$PATH"`).
**Tests:** `tests/unit/smoke.test.ts` asserts `1+1===2` and that `@kb/shared` index imports. Add `tests/unit/lint-boundaries.test.ts`: writes a temp file containing `Math.random()` into a temp copy dir and runs the script with an env override `KB_LINT_ROOT` → expects exit 1 (add that env var support to the script).
**STOP if:** pnpm install fails on a version from spec §2 — report the exact error, do not change versions.
**Commit:** `S0: scaffold pnpm monorepo, tooling and boundary lint`

## S1 — Fixed math, RNG, input bytes, history
**Files:** `packages/shared/src/fixed.ts`, `rng.ts`, `input/buttons.ts`, `input/history.ts`, `tests/unit/fixed.test.ts`, `rng.test.ts`, `buttons.test.ts`, `history.test.ts`.
**Steps:** copy code verbatim from spec §3 and §5.1. `history.ts`: `pushInput(f: {history:number[]; historyHead:number}, b)`, `inputAt(f, ago)` (ago 0 = this frame), `pressed(f, mask, ago=0)` (set at `ago`, clear at `ago+1`), `heldFrames(f, predicate)`.
**Tests (min):** idiv(-7,2) = -3; nextRng(1) sequence first 3 values fixed (record them once, assert equality); rngInt range; cleanSocd cases (L+R, U+D); numpad for all 9 directions × both facings (18 asserts); history wrap-around at 40; pressed edge detection.
**Commit:** `S1: add fixed-point helpers, xorshift RNG and input history`

## S2 — Motion parser
**Files:** `packages/shared/src/input/motion.ts`, `tests/unit/motion.test.ts`.
**API:** `detectMotion(f, facing, motion, window): boolean` for `qcf qcb dp dqcf dd spin`; `updateCharge(f, facing)` maintains `chargeBack`/`chargeGrace`; `chargeReady(f)`.
**Steps:** implement spec §5.3 exactly (in-order scan backward from newest frame; diagonal tolerance table).
**Tests (each motion, both facings):** valid input passes; same input spread over window+1 frames fails; out-of-order fails; `qcf` with 1 instead of 3 fails; `dp` accepts 6,3,2,3; `spin` accepts 4,1,2,3,6,9,8 and 6,3,2,1,4,7,8; charge needs 40 back frames, 39 fails, grace 10 frames after release works, 11 fails; priority helper `resolveRequest()` returns super over qcf when both match.
**Commit:** `S2: add motion-command parser with charge and 360 support`

## S3 — Character data
**Files:** `packages/shared/src/chars/{types.ts,base.ts,bolt.ts,volt.ts,chompa.ts,kaze.ts,bao.ts,index.ts}`, `tests/unit/chars.test.ts`.
**Steps:** types verbatim from spec §6 (including `gravityScale`, `lockOnHit`, `airJumpMax`). `base.ts` exports the 13 templates from characters.md §1 and `normal(id, overrides)`. Each char file exports `const BOLT: CharDef` etc. with every number from characters.md. Moves for LP/HP variants are **separate MoveDefs** with ids `<id>.L` / `<id>.H` (and `.K` variants for kicks). `index.ts` exports `CHARS: Record<CharId, CharDef>` and `getMove(charId, moveId)`.
**Tests:** every char has the 13 base ids + 1 command normal + 3 specials (with variants) + 1 super; all ids unique per char; every `hits[].frames` lies within `[startup+1, startup+active]` (counter stances excepted); balance guardrails §9 rules 1, 3, 4, 5 (rule 2 after S7 once velocities exist—assert it here from data too).
**STOP if:** a value in characters.md is missing for a field the type requires — list the gaps under S3 as BLOCKED.
**Commit:** `S3: add character data model and roster frame data`
**Notes (S3 session):** shipped with provisional values isolated in `chars/base.ts` / TODO comments; confirm or correct:
- RESOLVED (owner/spec, 2026-11-04): missing `hitstun` = blockstun + 4. Rule added to characters.md §1 Special defaults.
- RESOLVED: egg lifetime 120 and jadeDragon offset (60,60) are confirmed and written into characters.md.
- RESOLVED: add `levels: Level[]` to `counter` (spec §6). LK = ["mid","overhead"], HK = ["mid","low"]. **S6 adds the field and data** (S3 data stays as-is until then).

## S4 — Sim core: movement
**Files:** `packages/shared/src/sim/{types.ts,constants.ts,state.ts,step.ts,fighter.ts,physics.ts,checksum.ts}`, `tests/unit/sim-movement.test.ts`.
**Steps:** spec §4, §7, §8 (only states idle/walk/crouch/jumpSquat/air/land/dash, facing, pushboxes, walls, gap clamp). `hits()`/`projectiles()`/`round()` are empty stubs calling nothing yet (except phase intro→fight after 120 frames). Test helper `tests/helpers/run.ts`: `runFrames(state, [[b0,b1], ...])` and `hold(b0, b1, n)`.
**Tests:** walk speeds per char; jump apex height (Bolt: 14310 units, the exact discrete sum of per-frame velocities; the continuous estimate 15125 does not apply); jump duration; jumpSquat 4 frames; landing recovery 3; walls clamp; gap clamp 520 px; pushbox separation; cross-up side switch & facing update; dash distances; Kaze double jump only once; facing doesn't change mid-air.
**Commit:** `S4: add deterministic sim core with movement and pushboxes`

## S5 — Attacks, hits, blocks, throws
**Files:** `sim/hit.ts`, updates to `fighter.ts`, `step.ts`; `tests/unit/sim-hit.test.ts`, `sim-block.test.ts`, `sim-throw.test.ts`, `sim-combo.test.ts`.
**Steps:** spec §8.1 attack start/advance/cancel, §8.3 entire (counter hit, combo scaling, juggle rules, trades, hurtExtend, throws + tech, command grabs).
**Tests (each named after a rule):** LP hits standing dummy at 50 px, whiffs at 120 px; damage exact; hitstun length; blockstun length; frame advantage LP on block = +1 (Bolt); low must be crouch-blocked (stand-block fails); overhead must be stand-blocked; airborne can't block; chip can't KO; counter hit ×1.2 +2 stun; combo scaling sequence 100/100/80/70; cancel LP→special only on hit/block not whiff; chain LP→LP; trade both damaged; hitstop both 8 / 11; pushback transfer at wall; throw connects at 70 px not 71; tech within 7 frames; throw whiff recovery; juggle invulnerability except launch moves; knockdown → getup invuln.
**Commit:** `S5: add attack resolution, blocking, combos and throws`
**RESOLVED (2026-11-04):** +1 is correct (matches characters.md §9 guardrail: blockstun − (remaining active − 1 + recovery)). The +2 in the test list was a spec typo; data unchanged.
**Notes (S5 session):** Bolt `6HP` (Hat Butt) box starts at y 70 = crouch hurtbox top, so it whiffs crouchers under strict AABB; fix in data (S3 owner) if overheads should hit crouchers. Other interpretations: docs/test-results/S5.md.

## S6 — Projectiles and specials
**Files:** `sim/projectile.ts`, special-case handlers in `sim/specials.ts` (teleport `smokeStep`, `counter` stance, `gulpGrab` sequence, `stampedeRoll` wall rebound, `overload` multi-spawn, `heal`, `lockOnHit`), `tests/unit/sim-projectile.test.ts`, `sim-specials-<char>.test.ts` (5 files).
**Rule:** special behaviour is triggered by data fields (`projectile`, `grab`, `counter`, `heal`, `lockOnHit`) or by an explicit switch on move id in `specials.ts` — **only** for `smokeStep`, `stampedeRoll`, `overload`, `shurikenFan.H`, `tailSpin` (two-sided box). No other per-id code.
**Tests:** one projectile limit; clash; egg ground explosion; spark 2 hits with interval; each special does its listed damage on hit and its listed block advantage; DP invuln beats a jump-in that would otherwise hit on frame 3; smokeStep lands behind; bambooCounter LK parries `5HP` but not `2LK`; gulpGrab range 80/65; tailSpin charge required.
**Commit:** `S6: add projectiles and character specials`
**Notes (S6 session):** interpretations in docs/test-results/S6.md. Data findings for the owner (data unchanged):
- jackhammerRise / liveWireHop later hits miss grounded opponents (boxes rise above 110 px); hardHatHop misses crouchers.
- jadeDragon lands 4 of 5 hits on a grounded opponent (defender frozen in hitstop while it moves on) → 200, not 250.
- S7 needs a rule for combo scaling on multi-hit supers ("no scaling" totals).

## S7 — Supers, meter, rounds, determinism
**Also implement decision 0003:** hardHatHop box `0,-40,55,50`; multi-hit projectiles freeze during the hitstop they cause; super hits use the first hit's scaling; rising-special balance totals measured vs an airborne target. Add a test for each.
**Files:** `sim/round.ts`, meter logic in `hit.ts`/`fighter.ts`, `tests/unit/sim-super.test.ts`, `sim-round.test.ts`, `determinism.test.ts`, `balance.test.ts`.
**Tests:** super freeze 40 frames, meter cost; each super total damage matches characters.md ±1 (no scaling, fresh combo); round timer 99 s; time-over winner; double KO draw; best of 3; meter carried between rounds; spec §16 determinism (a)(b)(c); balance guardrails all 5 rules.
**Commit:** `S7: add supers, meter, round flow and determinism suite`
RESOLVED by decision 0004 (same-move hits continue a juggle; liveWireHop vs air = 84, retune in S15).

## S8 — Client shell + local 2P (debug boxes)
**Files:** `apps/client/src/{main.ts,app/GameLoop.ts,app/AppFlow.ts,input/Keyboard.ts,input/InputSource.ts,render/Canvas.ts,render/Camera.ts,render/DebugDraw.ts}`.
**Steps:** fixed-step loop (accumulator, max 4 sim steps per rAF, spec §9.1 canvas scaling); `DebugDraw` draws fighters as hurtbox rectangles (blue), hitboxes (red), pushboxes (green), projectiles (yellow), plus hp/timer text. Keyboard maps P1/P2 (spec §12.1). Toggle `F1` = debug boxes on/off (stays available later in dev builds). Expose `window.__kb = { state, step }` only when `import.meta.env.DEV`.
**Manual check (record in evidence):** `pnpm dev:client`, two players on one keyboard can walk, jump, attack, block, throw, KO.
**Commit:** `S8: add client game loop, keyboard input and debug renderer`

## S9 — Puppet renderer
**Files:** `render/Puppet.ts`, `render/poses.ts`, `render/clips.ts`, `render/skins/{types.ts,bolt.ts,volt.ts,chompa.ts,kaze.ts,bao.ts}`, `tests/unit/poses.test.ts`.
**Steps:** spec §9.2–9.3 and each character's **Look / skin** block. `clips.ts`: `clipFor(fighter, moveDef): {pose, nextPose, t}` using the clip timing rule. Pure functions for bone positions: `solveBones(skin, pose, facing) → Record<BoneId,{x0,y0,x1,y1}>` (testable without canvas).
**Tests:** `solveBones` idle: torso end above root; `jab` fistF x > shoulder x for facing 1 and < for facing −1; every pose name used by any MoveDef exists in `poses.ts`; every skin defines all required bones.
**Visual check:** add `/?gallery` dev page drawing all 5 characters × 12 key poses in a grid; take a screenshot into `docs/test-results/S9-gallery.png`. **STOP and report** with the screenshot for owner approval before S10 (art direction checkpoint).
**Commit:** `S9: add code-drawn puppet rig, pose library and five skins`

## S10 — FX, HUD, stages + audio integration
**Prerequisites:** S9 and S10a DONE.
**Files:** `render/Fx.ts`, `render/Hud.ts`, `render/Stage.ts`, `render/stages/{rooftop,bamboo,volcano}.ts`. Audio module implementation belongs to S10a.
**Steps:** spec §9.4–9.6 and characters' VFX lines. FX consume `state.events` exactly once per frame (`lastFxFrame` guard). Consume S10a audio APIs from the presentation layer; integration must preserve the frame guard and gesture-unlock lifecycle.
**Tests:** `Hud` format helpers (timer digits, combo text) unit-tested; Fx particle pool never exceeds 256 under 1000 events.
**Commit:** `S10: add hit effects, HUD, procedural stages and synthesized audio`

## S10a — Standalone synthesized audio + stage music
**Prerequisites:** S0 DONE. No S9 renderer dependency; no changes to S9 files.
**Files:** `apps/client/src/audio/{AudioBus.ts,synth.ts,sfx.ts,music.ts}`, `tests/unit/audio.test.ts`, `docs/test-results/S10a.md`, `docs/tasks.md`.
**Scope (owner-requested):** split the audio module implementation from S10. Implement spec §13 procedural sound recipes, one four-bar bass/drum loop per stage, default music volume 0.25, volume/music controls for later Settings integration, gesture unlock, and resource cleanup. Presentation wiring remains S10; Settings UI remains S11.
RESOLVED by decision 0006
**Tests:** offline fake-WebAudio tests for unlock, volume/toggle controls, stage loop switching, bounded voices and disposal; recipe tests against §13; required repository checks. Browser listening and physical iPad checks must be recorded NOT RUN unless actually performed.
**Commit:** `S10a: add synthesized combat audio and stage music`

## S11 — Menus, CPU, Training
**Files:** `ui/{Title,CharSelect,VsScreen,Results,Settings,HowToPlay,Pause}.ts`, `ui/experience.css`, `packages/shared/src/ai/cpu.ts`, `tests/unit/cpu.test.ts`.
**Steps:** spec §15, §11.5, §11.6. Settings: volume, music toggle, key rebinding, debug boxes (dev only), CPU difficulty.
**Tests:** CPU deterministic (same seed → same inputs over 3000 frames); CPU vs CPU match ends with a winner within 3 × ROUND_FRAMES; CPU on hard blocks ≥ 70% of `5HK` attempts in a scripted scenario.
**Commit:** `S11: add menus, character select, CPU opponent and training mode`

## S12 / S12b — Server infra + two-human FightRoom
**S12b scope (owner-confirmed):** two human players only; full §11.2/§11.3 authority flow and existing S12 tests. CPU seats are deferred to S12c. Prerequisites S7 and S12a are DONE.
**Files:** copied server files per spec §14; `apps/server/src/rooms/FightRoom.ts`, `packages/shared/src/net/protocol.ts`, `ops/scripts/{play.ts,invite.ts,admin-setup.ts,admin-hash.ts,revoke-session.ts,secrets-scan.ts}`, `tests/integration/fight-room.test.ts`, `tests/unit/protocol.test.ts`.
**Steps:** spec §11.2, §11.3. Copy auth/invite/session/admin unchanged except names. Room name `fight`.
**Tests:** protocol rejects out-of-range `b`, negative `f`, unknown `t`; integration: 2 sdk clients pick, ready, receive `start`, send 600 frames of scripted inputs, receive `cf` for all frames, `hash` matches local replay; a client that stops sending gets inputs auto-filled after 100 ms; reconnection within 20 s resumes; forfeit after 20 s.
**Commit:** `S12: add server infrastructure and input-authoritative FightRoom`

## S12c — Server CPU seats
**Prerequisites:** S11 and S12b DONE.
**Files:** `apps/server/src/rooms/FightRoom.ts`, `tests/integration/fight-room-cpu.test.ts`.
**Steps:** add CPU seats to FightRoom using `packages/shared/src/ai/cpu.ts` per spec §11.3.
**Tests:** one integration test of a human against a CPU; standard repository checks.
**Commit:** `S12c: add server CPU seats to FightRoom`

## S13 — Rollback client + online flow
**Files:** `apps/client/src/net/{RoomClient.ts,ClockSync.ts,Rollback.ts}`, `ui/Lobby.ts`, `ui/RoomList.ts`, `tests/unit/rollback.test.ts`, `tests/integration/rollback-e2e.test.ts`.
**Steps:** spec §11.4 exactly. Rollback is pure (no DOM) so unit tests can drive it with a fake clock/server.
**Tests:** spec §16 rollback test; stall at MAX_ROLLBACK; late own input replaced by server → client rolls back own input; snapshot resync recovers from a forced desync (mutate client hp); FX not replayed on rollback.
**Manual:** two browser tabs on one machine play a full match; record ping display (`RTT ms` in corner, dev only).
**Commit:** `S13: add rollback netcode client and online match flow`

## S14 — Touch, gamepad, iPad
**Files:** `input/Touch.ts`, `input/Gamepad.ts`, `input/Macro.ts`, `ui/LayoutEdit.ts`, `public/manifest.webmanifest`, `public/sw.js`, `ops/scripts/play.ts` (verify), `tests/unit/macro.test.ts`.
**Steps:** spec §12.2–12.3, per-character SP tables. Macros produce bytes that pass `detectMotion` (test this for every character and every SP direction, both facings).
**Device check:** iPad Safari via `pnpm play` → record as NOT RUN until the owner runs it; status becomes IMPLEMENTED – DEVICE CHECK PENDING.
**Commit:** `S14: add touch controls with easy specials, gamepad and PWA`

## S15 — Browser tests and release checklist
**Files:** `tests/browser/{title,cpu-match,online-two-tabs}.spec.ts`, `docs/release-checklist.md`, `README.md`.
**Steps:** spec §16 browser tests; README quick start mirroring battlegrounds (`pnpm play`, admin setup, invite). Release checklist: frame-rate sample on iPad (NOT RUN placeholder), audio unlock, reconnect, all 5 chars × all specials manually exercised (checkboxes).
**Commit:** `S15: add browser tests, README and release checklist`


## PERF — Render performance
**Prerequisites:** TXT DONE. Decision 0014. Render-only; never touch `packages/shared/src/sim`.
**Files:** `apps/client/src/render/{Canvas.ts,Stage.ts,stages/*.ts,Hud.ts,Fx.ts,Puppet.ts}`, `apps/client/src/app/{GameLoop.ts,AppFlow.ts}`, new `apps/client/src/render/Layers.ts`, new `apps/client/src/render/FrameStats.ts`, `tests/unit/perf.test.ts`.
**Steps:**
1. Baseline: in headless Chromium (existing browser-test setup) with 4× CPU throttle, record avg / p95 frame ms over 600 fight frames, CPU vs CPU, each stage. Write numbers to `docs/test-results/PERF.md`.
2. `Canvas.ts`: backing scale = `Math.min(2, Math.max(1, Math.round(fit * devicePixelRatio)))` (cap 2). Call `getContext('2d', { alpha: false, desynchronized: true })`. Move the scale check out of `begin()` into the resize listener plus a `matchMedia('(resolution: Xdppx)')` change listener (remove it in `dispose`).
3. `Layers.ts`: `cacheLayer(key, w, h, paint)` returns an offscreen canvas painted once at the backing scale. Each stage splits into `static` parts (sky gradient, far layer, mid layer, floor), each cached at width `640 + 1200*factor` and drawn with one `drawImage` at `layerX`. Only animated decorations (sway, embers, lava pulse, beacons) stay per-frame, at most 40 primitives per stage per frame. Invalidate the cache when the scale changes.
4. `Hud.ts`: cache the static frame (bar backgrounds, plates, labels) in one layer; draw only the fills each frame.
5. `Fx.ts`/`Puppet.ts`: no `save/restore` per particle (set state once per batch). No string concatenation or array/closure allocation inside the per-frame draw path (hoist it to module scope). Text with stroke (COUNTER/K.O.) is pre-rendered to a sprite per string.
6. `FrameStats.ts`: a dev-only overlay (`?fps`) showing fps and avg/p95 ms over the last 120 frames. Fixed-size ring buffer, no allocation.
7. `GameLoop.ts`: if 3 consecutive frames take > 20 ms, set `lowFx = true` (halves the particle cap, skips trails); expose it for FX. Reset it on scene change.
8. Re-measure with the same method. **STOP and report** if avg ms did not improve by ≥ 25 % on every stage; write the numbers in PERF.md either way.
**Tests:** `perf.test.ts`: `cacheLayer` paints once for repeated calls with the same key and repaints after `invalidateLayers()`; the FrameStats ring buffer computes p95 correctly for a known array. Fx draw allocates 0 particles after warm-up (count pool objects).
**Checks:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, plus the browser tests. iPad fps check: NOT RUN.
**Commit:** `PERF: cache stage/HUD layers, cap backing scale, add frame stats`

## CTRL — One-button specials, super button, faster meter
**Prerequisites:** PERF DONE. Decision 0014.
**Files:** `apps/client/src/input/{Macro.ts,Keyboard.ts,Gamepad.ts,Touch.ts,InputSource.ts}`, `apps/client/src/ui/{Settings.ts,HowToPlay.ts,LayoutEdit.ts}`, `apps/client/src/app/{AppFlow.ts,Training.ts}`, `packages/shared/src/sim/{constants.ts,hit.ts}`, `tests/unit/{macro.test.ts,ctrl.test.ts}`, `docs/spec.md` §12 (update the text to match).
**Steps:**
1. Settings: add actions `SP` and `SU` (not sim bits; client-only). Defaults: P1 `SP`=`KeyL`, `SU`=`KeyO`; P2 `SP`=`Numpad6`, `SU`=`Numpad3`. Gamepad: RB=SP, RT=SU. Rebindable like the other actions; migrate stored key maps that lack them.
2. One `MacroPlayer` per local player shared by all sources (keyboard, gamepad, touch). A source reports `spPressed`/`suPressed` edges; the player reads the stick at the press frame → `spDirection` → `buildMacro`. While a macro plays, the player's direction/buttons are overridden by the macro bytes. Remove the double-SP super rule (`DOUBLE_SP_FRAMES`).
3. `SU` edge: if meter ≥ `SUPER_COST`, play `buildSuper`; else ignore it (no queueing).
4. Touch: add a `SUPER` button 64 css px left of `SP`, glowing gold when the meter is full and greyed otherwise. `SP` shows a small label of the move the current stick direction will trigger (`spLabel(char, dir)` → the move's display name from characters.md).
5. Throw stays `LP+LK` (existing). Add keyboard chord help in How to Play.
6. Meter: `METER_ON_WHIFF_SPECIAL` 15, `METER_DEFENDER_PERCENT` 60; in `hit.ts` lines `addMeter(a, idiv(h.meterOnHit, 2))` → `addMeter(a, idiv(h.meterOnHit * 3, 4))` and `addMeter(a, h.meterOnHit)` → `addMeter(a, idiv(h.meterOnHit * 3, 2))`. Update the determinism golden hashes only through the existing regenerate script, and note this in CTRL.md.
7. How to Play / Training move list: show `SP`, `→SP` (same as neutral), `↑SP`, `←SP`, `↓SP`, `SUPER` per character, with no motion notation.
**Tests:** keyboard SP + each direction yields bytes that `detectMotion` accepts, for every char × both facings; SU with meter < cost emits nothing; SU with a full meter emits bytes that trigger the super in a sim run; the stored-keymap migration adds SP/SU; meter after a scripted 5HP hit equals the new formula.
**Commit:** `CTRL: one-button specials and super for keyboard, pad and touch; faster meter`

## PLAT — One-way platforms
**Prerequisites:** CTRL DONE.
**Files:** new `packages/shared/src/sim/platforms.ts`, `packages/shared/src/sim/{physics.ts,fighter.ts,types.ts,state.ts,constants.ts,step.ts}`, `packages/shared/src/ai/cpu.ts`, `apps/client/src/render/stages/*.ts`, `apps/client/src/render/Camera.ts`, `tests/unit/platforms.test.ts`.
**Steps:**
1. `platforms.ts`: `export interface Platform { x0: number; x1: number; y: number }` (sim units). `PLATFORMS: Record<StageId, readonly Platform[]>`. Heights: compute `minApex` = the lowest neutral-jump apex across CHARS (a sim run in the test). `LOW = floor(minApex*0.55 / 100)*100`, `HIGH = floor(minApex*1.05 / 100)*100`. Layout for every stage: two LOW platforms `[-34000,-16000]` and `[16000,34000]`, one HIGH `[-9000,9000]`. Record the computed numbers in PLAT.md as constants (hardcode them; never compute at runtime).
2. Fighter fields: `platform: number` (-1 = none or the ground), `dropTimer: number`. Add them to `state.ts` init, the snapshot/hash and the protocol snapshot schema if the fields are listed explicitly there.
3. Landing (physics): when airborne and `vy < 0`, if `prevY >= p.y && y <= p.y && x in [x0,x1]` and `dropTimer == 0` → land on p (y = p.y, same landing code as the ground, `platform = index`). Check the platforms before the ground; highest first.
4. Walking or being pushed off the edge (`platform >= 0`, x outside the span) → `airborne = true`, `vy = 0`, `state = "air"`, `platform = -1`, no jump consumed.
5. Drop-through: on a platform, the DOWN press edge twice within 12 frames → `dropTimer = 10`, airborne, `vy = -100`. Crouch still works on platforms.
6. Hit knockback, juggles and knockdown use the same landing rule. Throws/supers that set y keep their existing code.
7. Projectiles ignore platforms.
8. Render: draw each platform as a stage-themed slab (rooftop: steel beam; bamboo: lashed bamboo; volcano: basalt ledge) in the cached mid/front layer, with a thin top highlight. The camera follows mid-Y of the fighters, clamped so the ground is always on screen.
9. CPU: if the opponent is on a higher platform and within 120 px horizontally, jump; if the CPU is on a platform and the opponent is on the ground more than 150 px away, drop.
**STOP and report** if the determinism suite or the rollback e2e fails after the change.
**Tests:** landing on LOW from a jump; passing up through from below; walking off the edge falls; double-tap down drops; a single down only crouches; same inputs → same hash (two runs); the rollback test still passes.
**Commit:** `PLAT: add one-way platforms with drop-through to sim and stages`

## FX — Game-feel effects
**Prerequisites:** PLAT DONE. Render/audio only; sim events are unchanged except where listed.
**Files:** `apps/client/src/render/{Fx.ts,Camera.ts,Puppet.ts,Projectiles.ts}`, new `apps/client/src/render/Trails.ts`, `apps/client/src/app/AppFlow.ts`, `apps/client/src/audio/sfx.ts`, `tests/unit/fx.test.ts`.
**Steps (each scales with `strength` 0/1/2; halve the particle counts when `lowFx`):**
1. Hit: white 1-frame silhouette flash of the defender; radial spikes 6/9/12; 4/8/14 debris sparks with gravity; an expanding ring shockwave (r 8→28/40/56 over 10 f); directional streak lines along the knockback.
2. Camera: trauma-based shake (`trauma += 0.25/0.45/0.7`, `shake = trauma² * 6px`, decay 0.05/frame, offsets from a seeded render-only noise, never `Math.random` in a way the sim can see); punch-zoom 1.04 for 6 f on strength 2.
3. Swing trails (`Trails.ts`): a ring buffer of the last 6 positions of the active limb tip while a move is in active frames; drawn as a tapering quad strip in the character accent colour, alpha 0.6→0.
4. Block: a hexagon shield flash in front of the defender plus a blue spark spray; parry: a jade shock ring plus 0.1 s desaturation of the background.
5. Landing/dash/jump: dust puffs (6), and a dash streak behind the fighter.
6. Super: full-screen accent flash, radial speed lines rotating, a portrait cut-in (existing) plus a bloom glow on the attacker; meter-full "ready" pulse on the HUD bar.
7. KO: 3 hit-flashes, 40 f render slow-mo (exists, keep), a zoom to the loser 1.15, a white-out ring, a screen crack effect for 30 f, then "K.O." sprite text.
8. Combo counter: a pop scale 1.4→1 per hit, colour heats from white→gold→red at 3/6 hits.
9. Audio: pitch +5 % per combo hit (cap +30 %); low-pass "thump" layer on strength 2.
10. A Settings toggle "Screen shake" (default on) and "Reduced effects" (sets `lowFx`).
**Tests:** shake trauma clamps to 1 and decays to 0; the trail ring buffer keeps ≤ 6 points; under 1000 events the particles stay ≤ the cap (256, or 128 with lowFx); FX are not replayed on rollback (the existing guard still holds).
**Visual check:** screenshots of hit/block/super/KO into `docs/test-results/FX-*.png`. **STOP and report** for owner approval.
**Commit:** `FX: add hitflash, shockwaves, trails, trauma shake and KO sequence`

## TUNE — Balance + CPU for the new mechanics
**Prerequisites:** FX DONE.
**Files:** `packages/shared/src/chars/*.ts`, `packages/shared/src/ai/cpu.ts`, `tests/unit/balance.test.ts`.
**Steps:** run 200 CPU-hard vs CPU-hard matches per pair with fixed seeds (existing harness). Every pair's win rate must be in 40–60 %; adjust only damage, startup and recovery numbers in char data, ±10 % per value. The CPU uses `↑SP` to recover onto platforms, and uses SUPER when its meter is full and the opponent is in range. **STOP and report** if any pair stays outside 35–65 % after 3 tuning passes.
**Commit:** `TUNE: rebalance specials and CPU for platforms and one-button super`

## SEL — Rotating character select (owner request 2026-11-05)
**Prerequisites:** PERF DONE. Inspired by battlegrounds' 3D select, but **no three.js** (no new deps; the fighters are 2D code-drawn puppets). Fake 3D only.
**Files:** `apps/client/src/ui/CharSelect.ts`, `apps/client/src/ui/experience.css`, new `apps/client/src/render/Turntable.ts`, `apps/client/src/render/Puppet.ts` (add an optional `yaw` to the draw options only), `tests/unit/turntable.test.ts`.
**Steps:**
1. `Puppet.ts`: option `yaw` (radians, render-only). Draw with a horizontal scale `cos(yaw)` (min |0.08|). Facing flips when `cos < 0`. Front/back limb draw order swaps when `sin(yaw) < 0`. Default yaw 0 must look identical to today (no change to gameplay draws).
2. `Turntable.ts`: `drawTurntable(ctx, skin, x, y, t, opts)` draws an elliptical podium (accent rim glow, cached sprite) and its shadow, plus the puppet in `idle` pose (breathing), yaw = `t * 0.02` (one turn about every 5 s). When a character is picked, it plays the win pose facing the camera (yaw eases to 0 over 20 f).
3. `CharSelect.ts`: a carousel of the 5 characters on a 3D ring: angle `θ_i = 2π i/5 − focus`, screen x = `R sin θ`, depth z = `cos θ`, scale `0.6 + 0.4*(z+1)/2`, alpha by depth, drawn back-to-front. Left/right (keys, d-pad, swipe) rotates the ring with an eased 18 f tween; the focused character is front and centre on the turntable with its name, stat bars and move list (CTRL labels). P2 or CPU selection shows a second smaller ring on the right (local 2P) or just the badge (online).
4. Background: a spotlight cone and particles in the focused character's accent colour (cached sprites, ≤ 30 particles).
5. Keep the existing select logic, events and online messages unchanged; this is presentation only. Clean up all listeners and rAF on exit.
**Tests:** ring math: the focused index has z = 1 and is drawn last; rotating 5 steps returns to the start; the yaw flip rule (cos < 0 → facing inverted); the draw order with yaw 0 matches the current draw order.
**Visual check:** screenshot `docs/test-results/SEL.png`. **STOP and report** for owner approval.
**Commit:** `SEL: add rotating turntable carousel character select`
