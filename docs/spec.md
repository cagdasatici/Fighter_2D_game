# Knockout Bash — Technical Specification v1

A 2D side-view, 1v1, best-of-3-rounds fighting game in the classic arcade style. Online two-player play over home Wi-Fi (same hosting model as `../battlegrounds_game`), iPad Safari (PWA) and desktop browsers. Five original characters (`docs/characters.md`). All art is generated in code (`docs/decisions/0001-asset-strategy.md`).

Every number in this file is a local design choice. When this file and code disagree, the file wins until a decision record in `docs/decisions/` changes it.

---

## 1. Glossary

| Term | Meaning |
|---|---|
| frame / tick | One 1/60 s simulation step. All gameplay timing is integer frames. |
| unit | Simulation distance. **1 px = 100 units.** All sim positions/velocities are integers in units. |
| facing | `1` = facing right (+x), `-1` = facing left. |
| local space | Box coordinates relative to fighter origin (feet centre), x forward (multiplied by facing), y up. |
| startup | Frames before the first active frame. Move frame `1..startup` are startup. |
| active | Frames the hitbox exists: frames `startup+1 .. startup+active`. |
| recovery | Frames after active, before the fighter can act. |
| total | `startup + active + recovery`. |
| hitstop | Frames both fighters freeze on contact (sim still ticks the counter). |
| P / K | Any punch (LP or HP) / any kick (LK or HK). |
| numpad notation | 1=down-back 2=down 3=down-forward 4=back 5=neutral 6=forward 7=up-back 8=up 9=up-forward, **relative to facing**. |
| QCF / QCB / DP | 2,3,6 / 2,1,4 / 6,2,3 |

---

## 2. Repository layout (pnpm monorepo, mirrors battlegrounds)

```
Fighter_2D_game/
  AGENTS.md
  package.json  pnpm-workspace.yaml  tsconfig.base.json  tsconfig.json  vitest.config.ts  playwright.config.ts
  .node-version            # 24.22.2
  docs/ spec.md characters.md tasks.md decisions/ test-results/
  ops/scripts/             # play.ts, invite.ts, admin-setup.ts, lint-*.mjs, secrets-scan.ts (copied, §14)
  packages/shared/src/
    index.ts
    fixed.ts               # integer math helpers
    rng.ts                 # xorshift32
    input/buttons.ts       # bit layout, direction helpers
    input/history.ts       # input ring buffer
    input/motion.ts        # motion-command parser
    sim/types.ts           # all sim state types
    sim/constants.ts       # numeric registry (§4)
    sim/state.ts           # createMatch(), cloneState()
    sim/step.ts            # step(state, inputs): the ONLY entry that advances a frame
    sim/fighter.ts         # per-fighter state machine
    sim/physics.ts         # movement, gravity, pushboxes, walls
    sim/hit.ts             # hit detection and resolution
    sim/projectile.ts
    sim/round.ts           # timer, KO, round/match flow
    sim/checksum.ts        # FNV-1a over state
    chars/types.ts         # MoveDef, CharDef
    chars/base.ts          # shared normal templates
    chars/bolt.ts volt.ts chompa.ts kaze.ts bao.ts index.ts
    net/protocol.ts        # zod message schemas
    ai/cpu.ts              # deterministic CPU brain
  apps/server/src/
    main.ts createServer.ts
    rooms/FightRoom.ts     # authoritative relay + sim (§11)
    auth/ http/ admin/ config/ ops/ net/   # copied from battlegrounds (§14)
  apps/client/src/
    main.ts
    app/AppFlow.ts GameLoop.ts SettingsStore.ts registerSw.ts
    net/RoomClient.ts ClockSync.ts Rollback.ts
    input/Keyboard.ts Touch.ts InputSource.ts
    render/Canvas.ts Camera.ts Puppet.ts poses.ts skins/*.ts Stage.ts stages/*.ts Fx.ts Hud.ts
    audio/AudioBus.ts synth.ts sfx.ts
    ui/Title.ts CharSelect.ts VsScreen.ts Results.ts Settings.ts Lobby.ts
  tests/unit/ tests/integration/ tests/browser/
```

Dependencies (exact versions, copy from battlegrounds lockfile): `typescript 7.0.2`, `vitest 5.0.5`, `@playwright/test 1.64.1`, `colyseus 0.18.10`, `@colyseus/ws-transport 0.18.4`, `@colyseus/schema 5.0.43`, `@colyseus/sdk 0.18.9`, `zod 4.6.7`, `vite 8.3.5`, `tsx 4.23.15`, `@types/node 24.0.0`. **No** three.js, rapier, phaser or pixi. Package scope `@kb/`.

Boundary rules (enforced by `ops/scripts/lint-boundaries.mjs`):
- `packages/shared` imports nothing from `apps/*`, no DOM types, no `node:*`.
- `packages/shared/src/sim/**`, `input/**`, `chars/**`, `ai/**`, `fixed.ts`, `rng.ts` must not contain: `Math.random`, `Date`, `performance`, `setTimeout`, `setInterval`, `Math.sin`, `Math.cos`, `Math.sqrt`, `Math.pow`, `Math.round`, `Math.floor`, `Math.ceil`, `**`, `parseFloat`, `toFixed`. Integer division only via `idiv()` from `fixed.ts`.

---

## 3. Determinism contract (rollback depends on it)

1. Sim state is a plain object tree of integers, booleans, short strings and arrays. No class instances, Maps, Sets, functions or `undefined` fields (use `null`).
2. `step(state, [in1, in2])` mutates `state` in place and is a pure function of `(state, inputs)`.
3. `cloneState(s)` = `structuredClone(s)`. Rollback saves clones.
4. `checksum(s)` = FNV-1a 32-bit over `JSON.stringify(s)` (key order is fixed because every object is built by a single factory). Returns an unsigned 32-bit int.
5. Randomness: only `rng.ts` xorshift32 stored in `state.rng`. Seed comes from the server at match start.
6. Iteration order: fighters always processed index 0 then 1; projectiles in array order; no object-key iteration in sim.

```ts
// packages/shared/src/fixed.ts
export const PX = 100;
export function idiv(a: number, b: number): number { return Math.trunc(a / b); }
export function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }
export function sign(v: number): number { return v > 0 ? 1 : v < 0 ? -1 : 0; }

// packages/shared/src/rng.ts
export function nextRng(s: number): number { // xorshift32, never returns 0 for s != 0
  let x = s | 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return x >>> 0;
}
export function rngInt(state: { rng: number }, n: number): number { // 0..n-1
  state.rng = nextRng(state.rng); return state.rng % n;
}
```

---

## 4. Numeric registry (`packages/shared/src/sim/constants.ts`)

```ts
export const FPS = 60;
export const STAGE_LEFT = -60000;      // -600 px
export const STAGE_RIGHT = 60000;      //  600 px
export const MAX_FIGHTER_GAP = 52000;  // 520 px: camera width 640 minus margins
export const START_X = 14000;          // fighters start at -140 px and +140 px
export const GRAVITY = 90;             // units/frame^2
export const JUMP_SQUAT = 4;           // frames on ground before leaving
export const LANDING_RECOVERY = 3;     // frames after empty landing
export const LANDING_RECOVERY_ATTACK = 4;
export const ROUND_FRAMES = 99 * 60;   // 5940
export const ROUNDS_TO_WIN = 2;
export const ROUND_INTRO_FRAMES = 120; // "ROUND n" + "FIGHT!"; inputs ignored
export const ROUND_END_FRAMES = 180;   // KO slow-down + win pose
export const KO_SLOWMO_FRAMES = 60;    // render-only slow motion; sim runs normally
export const METER_MAX = 1000;
export const SUPER_COST = 1000;
export const METER_ON_WHIFF_SPECIAL = 10;
export const METER_DEFENDER_PERCENT = 40; // defender gains 40% of damage taken as meter
export const SUPER_FREEZE_FRAMES = 40;    // both fighters frozen, super flash
export const THROW_RANGE = 7000;          // origin gap <= 70 px
export const THROW_STARTUP = 5;
export const THROW_TECH_WINDOW = 7;       // frames after being grabbed
export const THROW_DAMAGE = 120;
export const KNOCKDOWN_FRAMES = 40;       // lying on floor, invulnerable
export const GETUP_FRAMES = 20;           // invulnerable
export const JUGGLE_FALL_VX = 250;        // airborne-hit fall: away from attacker 2.5 px/f (multiplied by attacker facing)
export const JUGGLE_FALL_VY = 900;
export const PUSHBACK_FRAMES = 8;         // pushback distributed evenly over this many frames
export const CORNER_PUSH_TRANSFER = true; // if defender is at a wall, attacker takes the pushback
export const COMBO_SCALING = [100, 100, 80, 70, 60, 50, 40, 30]; // % by hit index; index>=7 uses 30
export const CHIP_KO_ALLOWED = false;     // chip cannot reduce hp below 1
export const INPUT_HISTORY = 40;
export const PROJECTILE_LIMIT_PER_PLAYER = 1;
```

Per-character physics live in `CharDef` (§6).

---

## 5. Input

### 5.1 Button byte (`input/buttons.ts`)
```ts
export const UP = 1, DOWN = 2, LEFT = 4, RIGHT = 8, LP = 16, HP = 32, LK = 64, HK = 128;
export type InputByte = number; // 0..255
/** Clean SOCD: left+right = neutral; up+down = up. */
export function cleanSocd(b: InputByte): InputByte {
  if ((b & LEFT) && (b & RIGHT)) b &= ~(LEFT | RIGHT);
  if ((b & UP) && (b & DOWN)) b &= ~DOWN;
  return b;
}
/** Numpad direction 1..9 relative to facing. */
export function numpad(b: InputByte, facing: 1 | -1): number {
  const fwd = facing === 1 ? RIGHT : LEFT, back = facing === 1 ? LEFT : RIGHT;
  const h = (b & fwd) ? 1 : (b & back) ? -1 : 0;
  const v = (b & UP) ? 1 : (b & DOWN) ? -1 : 0;
  return 5 + h + v * 3;
}
```

### 5.2 History
Each fighter keeps `history: number[]` of length `INPUT_HISTORY` (ring, `historyHead` index) storing the raw byte per frame, written **before** the fighter's state machine runs. "Pressed" = bit set this frame and clear the previous frame.

### 5.3 Motion parser (`input/motion.ts`)
A motion is a sequence of numpad directions that must appear **in order** in the history, each step found at or after the previous one, within `window` frames ending at the button press frame. Diagonal tolerance: a required `2` also matches `1` or `3`; a required `6` matches `3` or `9`; a required `4` matches `1` or `7`. Required diagonals (`3`, `1`) must be exact.

| Motion id | Sequence | Window |
|---|---|---|
| `qcf` | 2,3,6 | 12 |
| `qcb` | 2,1,4 | 12 |
| `dp` | 6,2,3 | 14 |
| `dqcf` (super) | 2,3,6,2,3,6 | 24 |
| `dd` (double down) | 2,5,2 | 14 (`5` = any direction without DOWN) |
| `spin` (360) | contains 4, 2, 6 and 8 in any order | 30 (an `8` may be the jump frame; a 360 grab may be input while the fighter is in JUMP_SQUAT frames 1-2 and cancels the jump) |
| `charge` | hold any back (1,4,7) for ≥40 consecutive frames, then 6 within 10 frames | — (fighter tracks `chargeBack` counter; reset to 0 the frame back is not held, but keep the value for 10 frames after release in `chargeGrace`) |

**Button press buffer:** a special triggers if its button is pressed on the current frame or any of the previous 3 frames (and nothing consumed it yet; set `buffered = 0` after use).

**Priority on a given frame** (first match wins): super (`dqcf`) → `spin` → `dp` → `qcf`/`qcb` (most recent final step wins; tie → `qcf`) → `charge` → `dd` → throw (LP+LK pressed within 2 frames of each other) → command normal → normal.

**Easy-special button (touch only, §12.3):** the touch layer converts `SP + direction` into the full motion over successive frames in the input stream, so the sim never knows about it.

---

## 6. Character data model (`chars/types.ts`)

```ts
export type Level = "mid" | "low" | "overhead";
export type MoveKind = "normal" | "command" | "special" | "super" | "throw";
export interface Box { x: number; y: number; w: number; h: number } // px, local space, (x,y) = bottom-left corner
export interface Invuln { from: number; to: number; kind: "full" | "strike" | "projectile" } // move frames, inclusive
export interface Velocity { frame: number; vx: number; vy: number | null } // set at move frame; vy null = unchanged; units/frame, vx forward
export interface HitDef {
  frames: [number, number];   // active move frames inclusive
  box: Box;
  damage: number; chip: number;
  hitstun: number; blockstun: number; hitstop: number;
  pushback: number;           // units total
  level: Level;
  knockdown: boolean;         // true: defender enters KNOCKDOWN after hitstun-free launch
  launch: { vx: number; vy: number } | null; // overrides knockdown trajectory
  meterOnHit: number;         // attacker meter gain on hit (block gives half)
}
export interface ProjectileDef {
  spawnFrame: number; offset: { x: number; y: number }; // px
  vx: number; vy: number; gravity: number;               // units
  w: number; h: number;                                    // px, centred
  hits: number; hitInterval: number; lifetime: number;
  damage: number; chip: number; hitstun: number; blockstun: number; hitstop: number; pushback: number;
  level: Level; knockdown: boolean; meterOnHit: number;
  kind: string;               // render key, e.g. "rivet", "spark"
  explodeOnGround: boolean;   // egg: becomes a 20-frame explosion hitbox w=80 h=60 on ground contact
}
export interface MoveDef {
  id: string; kind: MoveKind; name: string;
  input: { motion: "none" | "qcf" | "qcb" | "dp" | "dqcf" | "dd" | "spin" | "charge"; button: "LP" | "HP" | "LK" | "HK" | "P" | "K" | "LP+LK"; dir: number | null; stance: "stand" | "crouch" | "air" };
  startup: number; active: number; recovery: number;
  hits: HitDef[];
  projectile: ProjectileDef | null;
  velocities: Velocity[];
  invuln: Invuln[];
  hurtExtend: Box | null;     // extra hurtbox during active+recovery (makes whiffs punishable)
  cancelInto: ("special" | "super" | "chain")[]; // chain = LP->LP, LK->LK same-button rapid
  airborneFrames: [number, number] | null; // move frames during which fighter is airborne (rising specials)
  landingRecovery: number;    // for air moves / rising specials
  pose: string;               // animation key (render side, §9)
  sfx: string;                // render side
  heal: number;               // super heal, default 0
  grab: { range: number; damage: number; throwVx: number; throwVy: number } | null; // command grabs
  counter: { from: number; to: number; damage: number } | null; // parry stance
  gravityScale: number;       // % of GRAVITY while in this move, default 100
  lockOnHit: { hits: number; interval: number; damage: number; finalDamage: number; finalLaunch: { vx: number; vy: number } } | null; // supers that freeze positions after first hit (Bolt, Kaze)
}
export interface CharDef {
  id: "bolt" | "volt" | "chompa" | "kaze" | "bao";
  name: string; hp: number;
  walkFwd: number; walkBack: number;            // units/frame
  jumpVy: number; jumpVx: number;              // units/frame (vx used for 7/9 jumps)
  dashFwd: { frames: number; speed: number };   // 66 / 44 double-tap; speed units/frame
  dashBack: { frames: number; speed: number; invuln: number };
  pushWidth: number;                            // px, pushbox full width
  airJumpMax: number;                           // extra jumps in air (Kaze 1, others 0)
  hurt: { stand: Box; crouch: Box; air: Box };
  moves: MoveDef[];
}
```

Moves are merged with `chars/base.ts`: `normal(baseId, overrides)` returns a full `MoveDef` by shallow-merging overrides into the base template and replacing `hits` wholesale if provided. Base templates and every character's data are in `docs/characters.md`.

---

## 7. Sim state (`sim/types.ts`)

```ts
export type Phase = "intro" | "fight" | "roundEnd" | "matchEnd";
export type FState =
  | "idle" | "walkF" | "walkB" | "crouch" | "jumpSquat" | "air" | "land"
  | "dashF" | "dashB" | "attack" | "hitstun" | "blockstun" | "juggle"
  | "knockdown" | "getup" | "thrown" | "throwing" | "techSep" | "ko" | "win";
export interface Fighter {
  char: CharDef["id"];
  x: number; y: number; vx: number; vy: number;   // units; y=0 ground, up positive
  facing: 1 | -1;
  hp: number; meter: number;
  state: FState; stateFrame: number;               // frames spent in state, starts at 1
  move: string | null; moveFrame: number;          // current move id / 1-based frame
  moveHitMask: number;                             // bit i = hits[i] already connected this move
  stun: number;                                    // remaining hitstun/blockstun/knockdown frames
  hitstop: number;
  pushRemain: number; pushPerFrame: number;        // pending pushback (units, signed world x)
  crouching: boolean; airborne: boolean;
  invuln: "none" | "full" | "strike" | "projectile"; invulnFrames: number; // generic timer (getup, backdash)
  comboHits: number;                               // hits taken in current combo (defender side)
  history: number[]; historyHead: number;
  buffered: number;                                // button press buffer frames left
  chargeBack: number; chargeGrace: number;
  lastPressFrame: number;                          // for LP+LK throw window
  cancelOk: boolean;                               // current move connected and is cancelable
  counterArmed: boolean;
  airJumps: number;                                // extra jumps used this airtime
  gravityScale: number;                            // copied from current move each frame
  wins: number;
}
export interface Projectile {
  owner: 0 | 1; kind: string; x: number; y: number; vx: number; vy: number; gravity: number;
  w: number; h: number; hits: number; hitInterval: number; cooldown: number; life: number;
  def: string;                                     // "<charId>:<moveId>" to look up ProjectileDef
  exploding: number;                               // >0 = explosion frames left
}
export interface FxEvent { frame: number; kind: "hit" | "block" | "counter" | "throw" | "super" | "ko" | "parry" | "projectileClash" | "whiff" | "land" | "special"; x: number; y: number; strength: 0 | 1 | 2; by: 0 | 1 }
export interface MatchState {
  frame: number; rng: number; phase: Phase; phaseFrame: number;
  round: number; timer: number;                    // frames left
  superFreeze: number; superBy: 0 | 1 | null;
  fighters: [Fighter, Fighter];
  projectiles: Projectile[];
  events: FxEvent[];                               // cleared at the start of every step; render reads them
  stage: "rooftop" | "bamboo" | "volcano";
  winner: 0 | 1 | null; drawRounds: number;
}
```
`createMatch({ chars: [a, b], stage, seed })` builds this (P1 at `-START_X` facing 1, P2 at `+START_X` facing -1, hp = char.hp, meter 0, phase `"intro"`).

---

## 8. Frame step order (`sim/step.ts`) — implement exactly in this order

```
step(s, inputs):
  s.events = []; s.frame++
  for i in 0,1: push cleanSocd(inputs[i]) into history (always, even in hitstop/freeze, so motions survive)
  if s.superFreeze > 0: s.superFreeze--; return
  phase handling (§10): intro → ignore inputs (feed 0 to state machines); roundEnd/matchEnd → see §10
  for i in 0,1: if fighter.hitstop > 0 { hitstop--; continue to next fighter for steps A-C }
     A. updateFacing (only in idle/walk/crouch/land, and on the frame jumpSquat ends): face the opponent; if x equal keep facing
     B. stateMachine(fighter, opponent, input): choose/advance state & move (§8.1)
     C. physics(fighter): apply move velocities for this moveFrame, gravity if airborne, integrate x/y, land check (§8.2)
  pushboxes(s)            // separate overlapping fighters, walls, MAX_FIGHTER_GAP
  projectiles(s)          // move, lifetime, ground explode, clash (§8.4)
  hits(s)                 // §8.3 — both fighters' hitboxes evaluated BEFORE either is applied (trades allowed)
  pushback(s)             // apply pushPerFrame, transfer at walls
  timers & round (§10)
```

### 8.1 Fighter state machine (when `hitstop == 0`)
Actionable states: `idle, walkF, walkB, crouch, land (only after LANDING_RECOVERY), dashF/dashB (no)`, plus `attack` when `cancelOk` and the requested move's category is in `cancelInto`.

In actionable state, evaluate in order:
1. Move request via §5.3 priority (requires stance match: `air` moves only when airborne; specials with `stance:"stand"` usable from stand or crouch; super checks `meter >= SUPER_COST`; a special with a projectile is refused if the player already owns `PROJECTILE_LIMIT_PER_PLAYER` projectiles).
2. Jump: numpad 7/8/9 → `jumpSquat` for `JUMP_SQUAT` frames, then `air` with `vy = jumpVy`, `vx = {7:-jumpVx, 8:0, 9:+jumpVx} * facing`.
3. Dash: forward pressed twice within 12 frames with neutral in between (`6,5,6`) → `dashF`; `4,5,4` → `dashB` (invuln strike for `dashBack.invuln` frames from frame 1).
4. Crouch: numpad 1/2/3 → `crouch` (crouching = true).
5. Walk: 6 → `walkF` (`vx = walkFwd*facing`), 4 → `walkB` (`vx = -walkBack*facing`).
6. Else `idle`, vx = 0.

Starting a move: `state="attack"`, `move=id`, `moveFrame=1`, `moveHitMask=0`, `cancelOk=false`, `vx=0` if grounded (velocities table drives motion), meter: specials with no hit give `METER_ON_WHIFF_SPECIAL` at frame 1; supers subtract `SUPER_COST` at frame 1 and set `s.superFreeze = SUPER_FREEZE_FRAMES`, `superBy=i`, event `"super"`.

Advancing an attack: `moveFrame++`; when `moveFrame > total` → grounded: `idle` (or `crouch` if down held); air move: stays `air` (air normals end but fighter keeps falling; cannot attack again in the same jump). Air moves landing early: on landing, cancel move, `land` state with `LANDING_RECOVERY_ATTACK`.

Blocking (no button): a fighter in `idle/walkB/crouch` (or `walkB` request) holding back (4) or down-back (1) is "blocking"; it's resolved in §8.3 at contact time, not as a state. Proximity guard is not modelled.

Non-actionable states count `stun` down; at 0: `hitstun`/`blockstun` → `idle` (or `crouch` if was crouching), `knockdown` → `getup` (`GETUP_FRAMES`, invuln full) → `idle`. `juggle` ends on landing → `knockdown`.

### 8.2 Physics
- Grounded: `x += vx`. Airborne: `vy -= GRAVITY; x += vx; y += vy`. When `y <= 0` and `vy < 0`: `y=0, vy=0, airborne=false` → from `air`: `land` (LANDING_RECOVERY frames, not actionable except blocking); from `juggle`: `knockdown` (stun = KNOCKDOWN_FRAMES, invuln full); from rising special: `landingRecovery` frames in state `land`.
- `velocities` entries apply at their exact `moveFrame`: `vx = v.vx * facing`, `vy` if not null (setting vy > 0 makes the fighter airborne).
- Walls: `x` clamped to `[STAGE_LEFT + 2000, STAGE_RIGHT - 2000]`; camera constraint: `|x0 - x1| <= MAX_FIGHTER_GAP` (clamp the fighter that moved this frame; if both moved, clamp both symmetrically).
- Pushboxes: grounded fighters overlap if `|dx| < (w0+w1)/2*PX`; separate by moving each half the overlap (the one at a wall moves 0, the other moves full). Airborne fighters push only if `|dy| < 60*PX`; cross-ups allowed (if an airborne fighter lands exactly overlapping, push it to the side it is already on, ties → side of its facing reversed).

### 8.3 Hit detection and resolution (`sim/hit.ts`)
World box for local box `b` of fighter `f`: `left = f.x + (facing==1 ? b.x : -(b.x+b.w))*PX`, `right = left + b.w*PX`, `bottom = f.y + b.y*PX`, `top = bottom + b.h*PX`. AABB overlap is strict (`<`).

For attacker `a` (both evaluated first, then applied):
1. Skip if `a.hitstop > 0` or no `hits[k]` whose `frames` contain `moveFrame` with bit `k` clear in `moveHitMask`.
2. Defender hurtboxes = state hurtbox (`stand`/`crouch`/`air`) ∪ the defender's own move `hurtExtend` (if defender is in active or recovery of its move).
3. Skip if defender invuln covers strikes (`full` or `strike`; move invuln windows count too), or defender is in `knockdown`/`getup`/`ko`.
4. On overlap set bit `k`. Decide **blocked** if defender is grounded, not in `attack`/`hitstun`/`jumpSquat`/`dash*`, holds back, and level rule passes: `low` needs crouch-block (1), `overhead` needs stand-block (4), `mid` either. Airborne defenders cannot block.
5. Blocked: `hp -= chip` (not below 1), state `blockstun`, `stun = blockstun`, hitstop both = `hitstop`, pushback (defender is pushed away by `pushback` units over `PUSHBACK_FRAMES`; if defender is at a wall, attacker is pushed instead), attacker meter `+meterOnHit/2`, `cancelOk = true` if move cancelable, event `block`.
6. Hit: damage scaled by `COMBO_SCALING[min(defender.comboHits, 7)]` → `idiv(damage*scale, 100)`, minimum 1. `comboHits++`. If defender was in `attack` startup frames → **counter hit**: damage ×1.2 (`idiv(d*12,10)`), hitstun +2, event `counter`. Hitstop both. Attacker meter `+meterOnHit`; defender meter `+idiv(damage*METER_DEFENDER_PERCENT,100)`. Meter clamps to `METER_MAX`.
   - Defender airborne, or `knockdown: true`, or `launch` set → `juggle`, airborne, with `vx = (launch ? launch.vx : JUGGLE_FALL_VX) * a.facing` (pushes away from the attacker) and `vy = launch ? launch.vy : JUGGLE_FALL_VY`. Juggled fighters are invulnerable after the first juggle hit except to hits from moves with `launch` set (keeps juggles limited).
   - Else `hitstun`, `stun = hitstun`, pushback as above.
   - Counter-stance defender (`counterArmed` and `moveFrame` inside `counter.from..to`) instead: attacker takes `counter.damage`, attacker → `juggle`, defender gets 10 frames hitstop and `cancelOk=false`, event `parry`. Projectiles also trigger parry (projectile destroyed, no damage to owner).
7. `comboHits` resets to 0 whenever the defender returns to an actionable state.
8. If both fighters hit each other the same frame (trade), both apply.

Throws: on the throw's active frame (frame `THROW_STARTUP+1`), if opponent grounded, not airborne, not in hitstun/blockstun/knockdown/getup/throw-invuln, and `|dx| <= THROW_RANGE` → attacker `throwing`, defender `thrown` for 30 frames. If the defender presses LP+LK within `THROW_TECH_WINDOW` frames → both `techSep` 16 frames, pushed 6000 units apart, event `throw` strength 0. Else at frame 30 defender takes `THROW_DAMAGE` (no scaling), enters `knockdown` at position 80 px behind or in front per throw direction (holding back on start = throw backward, swap sides). Whiff: 22 recovery frames.

Command grabs (`grab` on MoveDef) use the same rules but are unteachable and use `grab.range`, `grab.damage`.

### 8.4 Projectiles
Spawn at `spawnFrame` of the move at owner `x + offset.x*PX*facing`, `y + offset.y*PX`, `vx*facing`. Each frame: `vy -= gravity; x += vx; y += vy; life--`. Remove when `life<=0`, `hits<=0`, or off stage by >100 px. `explodeOnGround`: when `y<=0`, set `y=0, vx=vy=0`, `exploding=20`, box becomes 80×60. Clash: two projectiles of different owners overlapping → each `hits--`, event `projectileClash`. Projectile vs fighter: like §8.3 but invuln kinds `full`/`projectile` ignore it; on contact `hits--`, `cooldown = hitInterval` before it can hit again; projectile hitstop freezes only the defender (projectile keeps moving).

---

## 9. Rendering (client only; floats allowed)

### 9.1 Canvas
- Logical resolution **640×360**, ground line at logical y = 320. Canvas backing size = logical × integer scale `k = max(1, floor(min(innerWidth/640, innerHeight/360) * devicePixelRatio))`; CSS letterboxes. `imageSmoothingEnabled = true` (puppets are vector-like).
- Camera: x = midpoint of fighters clamped so the view `[-320, 320]` px stays inside stage ±600 px; y follows the higher fighter only when it is above 140 px (lerp 0.15). Shake: on heavy hit `amp=4px, 8 frames`; super `6px, 12 frames`.
- Render runs on `requestAnimationFrame`; it draws the latest sim state plus interpolation `alpha` between the last two states only for fighter x/y (not poses).

### 9.2 Puppet rig (`render/Puppet.ts`)
Each fighter is drawn from bones. **Angle convention:** angle in degrees measured from straight up, positive = toward the facing direction. Direction vector for an absolute angle A (facing right, screen y down): `(sin A, -cos A)`. Absolute angle = parent absolute + local. A limb hanging straight down = 180.

Bones (parent → child), lengths come from the skin:
```
root (hip point, at fighter x, y + skin.hipHeight)
├─ torso      (from root, upward)       → neck at torso end
│   ├─ head   (from neck)
│   ├─ uArmF → fArmF → fistF             (shoulder = torso end - 4px along torso)
│   └─ uArmB → fArmB → fistB
├─ thighF → shinF → footF
├─ thighB → shinB → footB
└─ extras: tail (from root, pointing back), scarf (from neck), hat (on head) — optional per skin
```
Draw order: `extras behind → uArmB, fArmB, fistB → thighB, shinB, footB → torso → thighF, shinF, footF → head, hat → uArmF, fArmF, fistF → extras front`. "B" limbs use `skin.shade` (fill darkened 25%).

Shapes: each segment is a **capsule** (`lineCap round` stroke of width `skin.width[bone] + 4` in `skin.outline` then width `skin.width[bone]` in fill colour). Head, torso, fists, feet, belly are ellipses/rounded rects described by the skin. Outline is always 2 px dark (`#1b1b2a` unless the skin overrides).

### 9.3 Poses (`render/poses.ts`)
A pose = `{ root: {dx, dy}, a: Record<BoneId, number> }` (local angles, px offsets). Animation clip = `[poseName, frames][]`. Clip frame is chosen from `stateFrame`/`moveFrame` (deterministic, no render clock). Between keys interpolate angles linearly for smoothness.

Shared pose library (local angles; omitted bones = idle values). All characters use these unless their skin overrides a key.

| Pose | root dy | torso | head | uArmF | fArmF | uArmB | fArmB | thighF | shinF | thighB | shinB |
|---|---|---|---|---|---|---|---|---|---|---|---|
| idle | 0 | 8 | -8 | 140 | -110 | 160 | -120 | 160 | 20 | 200 | -10 |
| idle2 (breathe) | -1 | 10 | -8 | 138 | -112 | 158 | -122 | 160 | 20 | 200 | -10 |
| walk1 | 0 | 10 | -8 | 140 | -110 | 160 | -120 | 145 | 25 | 210 | -5 |
| walk2 | -2 | 10 | -8 | 140 | -110 | 160 | -120 | 175 | 10 | 190 | -20 |
| crouch | 30 | 25 | -20 | 125 | -100 | 150 | -115 | 110 | 80 | 200 | -60 |
| jumpUp | -6 | 5 | -5 | 120 | -90 | 150 | -110 | 120 | 60 | 190 | -40 |
| jumpTuck | 0 | 20 | -15 | 110 | -120 | 140 | -130 | 90 | 100 | 120 | 80 |
| blockHigh | 0 | -5 | 0 | 60 | -100 | 80 | -110 | 165 | 15 | 200 | -10 |
| blockLow | 30 | 15 | -10 | 80 | -110 | 100 | -120 | 110 | 80 | 200 | -60 |
| hitHigh | 0 | -25 | -20 | 200 | -20 | 210 | -20 | 170 | 10 | 205 | -10 |
| hitLow | 4 | 30 | 20 | 170 | -30 | 190 | -30 | 170 | 10 | 200 | 0 |
| fall | -10 | -70 | -20 | 230 | 0 | 250 | 0 | 140 | 30 | 160 | 20 |
| lying | 46 | -90 | 0 | 260 | 0 | 280 | 0 | 90 | 0 | 95 | 0 |
| jabWind | 0 | 5 | -5 | 140 | -120 | 160 | -120 | 160 | 20 | 200 | -10 |
| jab | 0 | 15 | -10 | 92 | 0 | 165 | -125 | 160 | 20 | 205 | -10 |
| strongWind | 0 | -10 | 5 | 200 | -90 | 140 | -100 | 160 | 20 | 200 | -10 |
| strong | 0 | 25 | -15 | 85 | -2 | 190 | -90 | 150 | 25 | 215 | -10 |
| lowKickWind | 0 | -5 | 0 | 140 | -110 | 160 | -120 | 120 | 70 | 200 | -10 |
| lowKick | 0 | -15 | 5 | 150 | -110 | 170 | -120 | 110 | 10 | 200 | -10 |
| roundWind | 0 | -10 | 5 | 150 | -110 | 170 | -120 | 70 | 100 | 195 | -5 |
| roundhouse | 0 | -30 | 15 | 170 | -100 | 190 | -110 | 80 | 5 | 195 | -5 |
| crJab | 30 | 30 | -20 | 95 | 0 | 150 | -115 | 110 | 80 | 200 | -60 |
| uppercutWind | 32 | 20 | -10 | 170 | -140 | 150 | -110 | 110 | 80 | 200 | -60 |
| uppercut | -4 | 5 | -15 | 20 | -10 | 170 | -100 | 160 | 15 | 200 | -10 |
| crShort | 34 | 20 | -15 | 125 | -100 | 150 | -115 | 95 | 0 | 200 | -60 |
| sweep | 40 | 45 | -30 | 160 | -60 | 200 | -40 | 95 | -5 | 200 | -70 |
| airPunch | 0 | 15 | -10 | 110 | -10 | 150 | -110 | 120 | 60 | 190 | -40 |
| airKick | 0 | -10 | 5 | 140 | -110 | 160 | -120 | 115 | 0 | 170 | 60 |
| airHeavy | 0 | 25 | -10 | 135 | -40 | 120 | -40 | 100 | 20 | 150 | 60 |
| throwGrab | 0 | 20 | -10 | 85 | -10 | 95 | -15 | 155 | 20 | 210 | -10 |
| throwToss | 0 | -20 | 10 | 10 | -10 | 20 | -10 | 165 | 15 | 205 | -10 |
| cast (projectile) | 0 | 20 | -10 | 88 | -2 | 100 | -10 | 145 | 25 | 220 | -10 |
| castWind | 0 | -10 | 5 | 220 | -60 | 230 | -60 | 160 | 20 | 200 | -10 |
| rise (anti-air special) | -10 | 0 | -20 | 0 | -5 | 170 | -100 | 160 | 20 | 170 | 40 |
| spin (rolling) | 20 | 120 | 0 | 60 | -150 | 80 | -150 | 60 | 140 | 80 | 140 |
| victory | 0 | 0 | -10 | 30 | -20 | 200 | -150 | 170 | 10 | 195 | -5 |
| ko | — | uses `fall` then `lying` |

Clip timing rule for moves (unless the character file gives a clip): startup frames → `<pose>Wind`, active → `<pose>`, recovery → interpolate back to `idle` (or `crouch`). Idle clip: `idle` 30 f, `idle2` 30 f, loop. Walk: `walk1` 8, `walk2` 8, loop (mirror order for walkB). Air: `jumpUp` while vy>0 and `jumpTuck` else.

Visual effects on fighters: hit flash (whole puppet tinted white for 2 frames on hit), counter flash (red 3 frames), super glow (outline becomes `skin.accent` and pulses 1 Hz while meter is full).

### 9.4 Effects (`render/Fx.ts`) — driven only by `state.events`
| Event | Visual |
|---|---|
| hit strength 0/1/2 | star burst: 6/8/10 lines, radius 10/16/24 px, white core + `#ffd84a` lines, 8 frames; 1 frame screen flash at strength 2 |
| block | blue (`#59c8ff`) chevron burst away from attacker, 6 frames |
| counter | red ring + text "COUNTER" 30 frames above defender |
| parry | jade ring expanding to 40 px, text "PARRY" |
| super | screen dims to 60% black, attacker drawn above dim, 3 speed lines diagonals, portrait banner with character name sliding in 12 frames, lasts `SUPER_FREEZE_FRAMES` |
| ko | 3 white flashes, text "K.O." scales 3x→1x |
| land | 4 dust puffs (grey circles r 3-6 px, fade 12 frames) |
| projectileClash | white flash + 8 sparks |
| special | 6 small accent-colour sparkles at hands |
Particles: pool of 256, fields `{x,y,vx,vy,life,max,r,color,kind}`; updated in render loop with fixed 1/60 increments; no allocation per frame.

### 9.5 Stages (`render/stages/*.ts`)
All drawn with gradients and shapes, 3 parallax layers (factor 0.2, 0.5, 1.0) + floor. Ground band from y=320 to 360.
- **rooftop** (Bolt/Volt home): sunset gradient `#ff9a5a→#5b3a7a`, far skyline of dark rectangles with lit windows (deterministic pattern from index), mid layer water tanks & crane silhouette, floor = tar roof with a white painted helipad arc.
- **bamboo** (Bao/Kaze home): morning gradient `#d8f3dc→#95d5b2`, far misty mountains (3 sine-ridge polygons), mid bamboo stalks (vertical capsules with node lines, gentle sway ±2 px render-time), floor = wooden dojo planks.
- **volcano** (Chompa home): dusk gradient `#3a0d0d→#b5381a`, far volcano triangle with glowing crater, ember particles drifting up, mid giant ferns (bezier fans), floor = dark rock with lava cracks glowing (pulse 0.5 Hz).

### 9.6 HUD (`render/Hud.ts`, drawn on canvas)
Top: two health bars 260×14 px from centre outward, yellow `#ffd84a` with red "recent damage" trail that drains 4 px/frame after 30 frames idle, names under bars, round win pips (2 per side), timer centre (2-digit, 32 px, turns red ≤10). Bottom: meter bars 180×8 per side, blue fill, flashes gold when full, text "SUPER!" when full. Combo counter on the attacker's side: "N HITS" when ≥2, fades 60 frames after combo ends. Round text: "ROUND n" (60 f) → "FIGHT!" (60 f). Font: system-ui bold with 3 px dark stroke.

---

## 10. Round and match flow (`sim/round.ts`)
- `intro` for `ROUND_INTRO_FRAMES` (positions reset, hp full, meter **kept** across rounds, projectiles cleared), then `fight`.
- During `fight`: `timer--` each frame not in superFreeze/hitstop-of-both.
- KO: when a fighter's hp ≤ 0 → state `ko` (juggle trajectory if was standing), phase `roundEnd`, event `ko`. Double KO = both lose → draw.
- Time over: higher `hp*1000/char.hp` (percent, integer) wins; equal → draw.
- `roundEnd` lasts `ROUND_END_FRAMES`; winner state `win` after landing. Then `wins++`; if a fighter has `ROUNDS_TO_WIN` → `matchEnd` (`winner` set), else `round++`, `intro`.
- Draw round: neither gets a win; after 3 draws in a match (`drawRounds`), the 4th round is final and a draw there is resolved by remaining hp (if equal, P1 wins — documented edge, extremely rare).
- `matchEnd` holds forever; the client shows Results and offers Rematch (server creates a new match with the same chars and a new seed when both press Rematch).

---

## 11. Online netcode (server-relayed, deterministic rollback)

### 11.1 Model
Both clients and the server run the same `step`. The **server** is the authority on *inputs* (the input stream it confirms is truth) and on *checksums*. Clients predict the remote input and roll back when the confirmed input differs.

### 11.2 Messages (`packages/shared/src/net/protocol.ts`, zod-validated both directions)
```ts
// client -> server
{ t: "pick", char: CharId }                          // in char select
{ t: "ready" }
{ t: "in", f: number, b: number }                    // input for sim frame f (int >=1), b 0..255
{ t: "ack", f: number, h: number }                   // client checksum at confirmed frame f (every 60 frames)
{ t: "resync" }                                      // asks for a state snapshot
{ t: "rematch" }
// server -> client
{ t: "lobby", slots: [{ name, char, ready, bot }, ...] }
{ t: "start", seed: number, chars: [CharId, CharId], stage: StageId, you: 0 | 1, startAtMs: number, delay: number }
{ t: "cf", f: number, b: [number, number][] }        // confirmed inputs for frames f .. f+len-1
{ t: "hash", f: number, h: number }                  // server checksum at frame f (every 60 frames)
{ t: "snap", f: number, state: MatchState }          // full resync
{ t: "end", winner: 0 | 1 | null }
```
Rate limit per client: ≤ 90 `in` messages per second (allow bursts of 20); other kinds ≤ 5/s. Invalid messages are dropped and counted (copy `InvalidMessageGuard`).

### 11.3 Server (`apps/server/src/rooms/FightRoom.ts`)
- `maxClients = 2`. Slots fill in join order. Admin/host may fill an empty slot with a CPU (`bot: true`); CPU inputs are produced on the server by `ai/cpu.ts` using the server's own state each frame.
- Char select: both `pick` + `ready` → server sends `start` with `seed = crypto random uint32 (non-zero)`, `stage` = host's choice or the home stage of P1's char, `startAtMs = now + 1500`, `delay = INPUT_DELAY (2)`.
- Server keeps `inputs[f] = [b0|null, b1|null]`. Every 1 ms of its `FixedClock` tick (60 Hz, copy `FixedClock.ts`) it confirms frames in order: frame `F` is confirmed when both inputs exist, **or** when `serverNow >= startAtMs + F*1000/60 + FORGIVE_MS (100)`; a missing input is filled with that player's previous confirmed input. Late inputs for already-confirmed frames are ignored.
- After confirming frames, it steps its own `MatchState` and broadcasts one `cf` per server tick containing all newly confirmed frames. Every 60th frame it also broadcasts `hash`.
- On `ack` mismatch with its own hash at that frame or on `resync`: send `snap` with its current confirmed state (max one snap per client per 2 s).
- Disconnect: room holds the slot 20 s (Colyseus `allowReconnection(client, 20)`); during absence the player's input repeats its last value **as neutral (0)**. After 20 s: opponent wins by forfeit (`end`).

### 11.4 Client (`apps/client/src/net/Rollback.ts`)
State:
```
confirmed: MatchState at lastConfirmedFrame (cf)
current:   MatchState at currentFrame (predicted)
localInputs: Map<frame, byte>        // my inputs, frame-tagged with delay
confirmedInputs: Map<frame, [b0,b1]>
snapshots: ring of 16 { frame, state } for frames (cf, current]
```
Per render tick:
1. `targetFrame = floor((serverNow() - startAtMs) * 60 / 1000) + lead`, where `serverNow` comes from `ClockSync` (copy from battlegrounds) and `lead = clamp(ceil(rttMs/2 * 60/1000) + 1, 1, 8)`.
2. While `currentFrame < targetFrame` and `currentFrame - cf < MAX_ROLLBACK (12)`:
   - sample local input `b`; store `localInputs[currentFrame + 1 + delay] = b`; send `{t:"in", f: currentFrame+1+delay, b}`.
   - inputs for frame `currentFrame+1`: mine = `localInputs[...] ?? 0`, theirs = `confirmedInputs[...]?.[them] ?? lastConfirmedTheirs`.
   - `step(current, inputs)`, save snapshot.
   If the cap is hit, the client **stalls** (renders the same frame); this is the only slowdown behaviour.
3. On `cf` messages: for each frame in order, store; if frame ≤ currentFrame and the inputs used for it differ from the confirmed pair (either player, because the server may have replaced my late input) → mark `rollbackFrom = min(...)`. Advance `confirmed` by stepping it with confirmed inputs up to the new `cf`.
4. If `rollbackFrom` set: `current = clone(confirmed)` if `rollbackFrom <= cf+1`, else clone the snapshot at `rollbackFrom - 1`; re-simulate to the old `currentFrame` using confirmed inputs where known and predictions otherwise. **Render events (`state.events`) from re-simulated frames are discarded** except the final frame's; sounds/FX for frames already shown are not replayed (track `lastFxFrame`).
5. Every `hash` message: compute `checksum(confirmed)` at that frame (keep a map frame→hash of the last 4 hashes) and send `ack`; if mismatch locally, send `resync`. On `snap`: replace `confirmed` and `current` with it, clear snapshots, set `currentFrame = cf = snap.f`.

### 11.5 Local modes use the same step
- **Versus CPU (offline):** `ai/cpu.ts` provides input 1; no network.
- **Local 2P (same device, keyboards):** two keyboard maps (§12.1).
- **Training:** P2 is a dummy with selectable behaviour (stand, crouch, block all, jump) and infinite hp/meter toggles; shows frame-advantage readout of the last move (`+N`/`-N`) computed from the frame both fighters became actionable.

### 11.6 CPU (`ai/cpu.ts`)
Deterministic, uses `rngInt(state)`… **never** the match rng (would desync) — it keeps its own `cpuRng` seeded from the match seed XOR 0x9e3779b9 and stored on the server / local loop, not in `MatchState`. Decides every 6 frames (difficulty `easy|normal|hard` → reaction delay 24/14/8 frames, block chance 30/60/85%, combo use off/on/on). Behaviour table:
| Situation | Action |
|---|---|
| opponent airborne approaching within 160 px | anti-air special (DP motion) or cr.HP |
| distance > 260 px | projectile if character has one (50%), else walk forward/dash |
| 90–260 px | poke with longest normal (HK/cr.HK), or jump-in 15% |
| < 90 px | LP,LP,cr.LK → special (combo chain) or throw 20% |
| opponent attack startup seen (after reaction delay) | block correct height per `level` (cheats by reading move data: acceptable for CPU) |
| meter full and opponent in hitstun within range | super |
CPU produces input bytes (including multi-frame motions via a queued macro list), so it goes through the exact same parser.

---

## 12. Controls

### 12.1 Keyboard (rebindable in Settings, stored in localStorage)
| | P1 | P2 (local 2P only) |
|---|---|---|
| Up/Down/Left/Right | W S A D | Arrow keys |
| LP HP LK HK | U I J K | Numpad 4 5 1 2 |
| Pause | Esc | — |

### 12.2 Gamepad (Gamepad API, standard mapping)
D-pad or left stick (deadzone 0.4, 8-way by angle sectors of 45°). Face buttons: X/□=LP, Y/△=HP, A/×=LK, B/○=HK.

### 12.3 Touch (iPad; `input/Touch.ts`, port PointerRouter ideas from battlegrounds)
- Left half: floating 8-way stick (appears where the thumb lands, radius 60 css px, deadzone 14 px, 45° sectors).
- Right side: 2×2 buttons (LP HP / LK HK) 72 css px, plus `SP` (easy special) 64 px above them.
- `SP` + stick direction at the moment of press emits a **macro** into the input stream over the next frames (uses the facing at the press frame), with the strongest button of the character's mapping:
  | Stick at press | Macro |
  |---|---|
  | neutral / forward | `qcf` + HP (or char's table in characters.md) |
  | up | `dp` + HP / HK |
  | back | `qcb` + the char's qcb button |
  | down | `dd` / `charge` / `spin` (char-specific) |
  | SP pressed twice within 20 frames with full meter | `dqcf` + super button |
  Macro frames: one direction per frame, button on the last frame. Charge macros require the player to have held back ≥40 frames (otherwise SP-down falls back to the char's alternate in characters.md).
- Multitouch: each pointerId tracked separately; buttons register on `pointerdown`, release on `pointerup/pointercancel`. Layout editable (copy LayoutEdit pattern). All listeners removed on scene exit.

---

## 13. Audio (`apps/client/src/audio`)
Copy `AudioBus.ts` and `synth.ts` from battlegrounds unchanged, then add `sfx.ts` recipes (all synthesized, no files):
| Key | Recipe |
|---|---|
| hitL / hitM / hitH | noise burst 30/50/80 ms, lowpass 2.5k/1.8k/1.2k, + sine thump 180/140/90 Hz |
| block | square 900 Hz 25 ms + noise 20 ms highpass 3k |
| whiff | bandpass noise sweep 1.5k→600 Hz 90 ms |
| jump / land | sine 300→500 Hz 60 ms / noise 40 ms lowpass 400 |
| projectile per char | rivet: metallic ping (2 detuned squares 1.2k); spark: saw 2k with 40 Hz tremolo; egg: pop (sine 600→200); shuriken: whoosh noise; jade: sine chord 523/659/784 |
| super | rising saw sweep 200→1200 Hz 400 ms + reverb tail |
| ko | low boom 60 Hz 600 ms + "KO" two-tone 880/440 |
| announcer | text-only, no voice (no TTS) |
Music: one procedural loop per stage (4-bar bass + drum pattern from synth), volume 0.25 default, toggle in Settings.

---

## 14. Reuse from `../battlegrounds_game` (copy, then rename `@eb/`→`@kb/`, "Elemental Battlegrounds"→"Knockout Bash")
| Source | Destination | Changes |
|---|---|---|
| `tsconfig.base.json`, `vitest.config.ts`, `playwright.config.ts`, `pnpm-workspace.yaml`, `.node-version` | same | none |
| `ops/scripts/lint-boundaries.mjs`, `lint-timers.mjs` | same | update banned patterns per §2 |
| `ops/scripts/play.ts`, `invite.ts`, `admin-setup.ts`, `admin-hash.ts`, `revoke-session.ts`, `secrets-scan.ts`, `make-icons.mjs`, `ops/scripts/lib/*` | same | names, room name `fight` |
| `apps/server/src/auth/*`, `http/*` (minus `sparringRoutes.ts`), `admin/*`, `config/env.ts`, `ops/StructuredLog.ts`, `net/InvalidMessageGuard.ts`, `net/RateLimits.ts`, `rooms/RoomDirectory.ts`, `createServer.ts`, `main.ts`, `sim/FixedClock.ts` | same paths | remove Rapier init, Arena/Practice/Bot/Sparring rooms; register `FightRoom` |
| `apps/client/src/app/registerSw.ts`, `swRouting.ts`, `UpdateWatcher.ts`, `SettingsStore.ts`, `ConnectionLifecycle.ts`, `net/ClockSync.ts`, `audio/*`, `ui/RoomList.ts`, `ui/adoptCss.ts`, `admin/*`, `public/sw.js`, `public/manifest.webmanifest`, `vite.config.ts`, `index.html`, `admin.html` | same | strip three.js; title, icons, theme colour `#ffd84a` |
| `docs/deployment-runbook.md`, decisions 0018, 0050, 0053 | `docs/` | rename |
Everything else (3D scene, Rapier, kits, sparring) is **not** copied.

---

## 15. Screens and flow (`apps/client/src/ui`, DOM overlays over the canvas)
`Title` (Play Online · Versus CPU · Local 2P · Training · Settings · How to Play) → Online: `Lobby` (Find a room / admin-created rooms list, copied RoomList) → `CharSelect` (5 portrait tiles rendered by the puppet in `idle`, name, 3-word style tag, stats bars Power/Speed/Range 1-5; cursor P1 blue, P2 red; stage picker for host) → `VsScreen` (90 frames, both puppets in victory pose, names slide) → Fight (canvas + HUD) → `Results` (winner puppet `victory`, rounds, Rematch / Character Select / Title). Pause (offline only) — online has no pause. "How to Play" lists each character's moves using notation arrows from `characters.md`.

---

## 16. Testing strategy
- **Unit (vitest, `tests/unit`)**: every module in `packages/shared` (motions, hit resolution, block levels, throws, projectiles, round flow, determinism).
- **Determinism**: 3 tests: (a) 20,000 frames random inputs from seeded generator, run twice → equal checksums; (b) same run with save at frame 5000, run 300 more, restore, re-run → equal; (c) `structuredClone` round-trip equals `JSON` round-trip.
- **Rollback (unit)**: drive two `Rollback` instances with a fake server that delays the remote input by 0..10 random frames; final checksums equal the server's.
- **Integration (`tests/integration`)**: real Colyseus server + two `@colyseus/sdk` clients run 600 frames of scripted inputs; assert hashes agree and `end` arrives after a scripted KO.
- **Browser (playwright)**: title loads, Versus CPU match starts, canvas non-blank (pixel sample), a scripted keyboard combo produces a hit (via a `window.__kb` debug hook available only in dev builds).
- Physical iPad checks are recorded as **NOT RUN** until a human runs them.
