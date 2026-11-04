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
| S10 | FX, HUD, stages + audio integration | S9, S10a | DONE (audio wiring moved to S10a, decision 0005) | COMMIT | docs/test-results/S10.md |
| S10a | Standalone synthesized audio + stage music | S0 | BLOCKED (copy contract question below) | | |
| S11 | Menus, char select, Versus CPU, Training, CPU AI | S10 | TODO | | |
| S12a | Server infra copy + FightRoom placeholder (no sim) | S0 | DONE | 5f40b10 | docs/test-results/S12a.md |
| S12 | Server infrastructure + two-human input authority (S12a + S12b) | S7 | DONE | aacf6a7 | docs/test-results/S12b.md |
| S12b | Two-human input-authoritative FightRoom | S7, S12a | DONE | aacf6a7 | docs/test-results/S12b.md |
| S12c | Server CPU seats | S11, S12b | TODO | | |
| S13 | Client rollback netcode + online flow | S11, S12 | TODO | | |
| S14 | Touch controls + gamepad + iPad PWA + play script | S13 | TODO | | |
| S15 | Browser tests, polish pass, release checklist | S14 | TODO | | |

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
**BLOCKED:** Spec §13 says to copy `AudioBus.ts` and `synth.ts` from battlegrounds unchanged. The reference bus hardcodes one ambient music buffer and its sound API accepts only battlegrounds recipe keys; it cannot play the required stage-specific music and new SFX recipes unchanged. May S10a adapt these two copied files to the Knockout Bash sound keys and stage loops while retaining their tested voice-cap, gain, suspension and disposal behavior?
**Tests:** offline fake-WebAudio tests for unlock, volume/toggle controls, stage loop switching, bounded voices and disposal; recipe tests against §13; required repository checks. Browser listening and physical iPad checks must be recorded NOT RUN unless actually performed.
**STOP:** resolve the copy-contract question above before implementing code.
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

