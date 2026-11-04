# 0007: S11 menus, CPU and training choices

Status: ACCEPTED (owner pre-approved run 2026-11-04; decided in the S11 session without owner questions).

**CPU (`packages/shared/src/ai/cpu.ts`)**
- API: `createCpu({ side, difficulty, matchSeed })` → plain-JSON `CpuState`; `cpuInput(cpu, state)` returns one
  input byte per frame (call once per frame, before `step`, with the pre-step state); `cpuSeed(seed)` =
  `(seed ^ 0x9e3779b9) >>> 0 || 1`. The CPU never reads or writes `MatchState.rng` and never mutates the state.
- Reaction delay: the CPU blocks once `opponent.moveFrame + 1 >= reaction` (the `+1` is the frame the coming
  `step` adds), i.e. it starts holding block `reaction` frames into the opponent's move. The block roll
  (30/60/85 %) is made once per opponent attack (keyed by the attack's start frame) and once per incoming
  projectile wave. Block height: overhead → back, everything else → down-back (blocks mid and low).
- Blocking is checked every frame; offensive decisions every 6 frames. While the opponent is mid-attack and the
  roll said "no block", the CPU does not start new actions.
- "Combo use off" (easy) also disables the DP anti-air (easy uses cr.HP). Characters.md bot styles are applied only
  where cheap: Chompa/any grappler uses its command grab at close range 35 %, Volt walks back 30 % at mid range.
- Spin macro is 6,3,2,1,4,7,8 then the button (characters.md Chompa); charge macro is 42 frames back then forward+button.

**Training (`apps/client/src/app/Training.ts`, new file)**: the local loop refills between steps (outside `step`,
so the sim stays pure): hp refills when a fighter is free again or drops below half (combos never KO), meter
stays full when toggled, the round timer is pinned at 99. Frame advantage = frames until the defender is free
minus frames until P1 is free, measured from P1's last hit/block contact. Options live in the pause menu.

**UI**: `apps/client/src/ui/dom.ts` (new, tiny helpers) is shared by the screens. "Play Online" is shown disabled
until S13. Settings are stored in localStorage `kb.settings.v1`, validated field by field on load; Escape, F1,
Tab and Enter cannot be rebound; rebinding a key that is in use swaps the two bindings. Debug boxes (F1 and the
Settings checkbox) are dev-build only. Vs CPU: P1 picks both characters in turn (blue then red cursor); the stage
defaults to P1's home stage (characters.md §8) unless picked. Offline match seeds are a local counter.
Results appear 90 frames after `matchEnd`.
