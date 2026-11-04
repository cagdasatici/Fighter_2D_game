# Knockout Bash release checklist

Fill in by hand on the release build (`pnpm play`). Leave a box unticked and write NOT RUN if it was not exercised.
Automated checks (`pnpm verify`, `pnpm test:browser`) are recorded in `docs/test-results/S15.md`.

Build: `________` (git short hash)  Date: `________`  Tester: `________`

## 1. Frame rate (iPad)
- [ ] iPad model / iPadOS version: `________` — NOT RUN
- [ ] 60 s Versus CPU fight on each stage (rooftop, bamboo, volcano); Safari Web Inspector timeline or visible stutter notes.
  Sample: average fps `____`, worst 1 s window `____` fps — NOT RUN
- [ ] Super freeze + two projectiles on screen: no visible drop — NOT RUN

## 2. Audio unlock
- [ ] Desktop: no sound before the first click/key; sound starts after it (title, then fight SFX + stage music).
- [ ] iPad (home-screen app): first tap unlocks audio; music resumes after switching apps and coming back.
- [ ] Settings: effects volume, music volume and music on/off take effect immediately and persist after reload.

## 3. Online and reconnect
- [ ] Two devices sign in (invitation link and/or open join), join the same room, ready, match starts on both.
- [ ] Both screens agree on hits, hp and round winner for a full match.
- [ ] Reconnect: turn Wi-Fi off on one device for ~5 s mid-round, turn it back on — it rejoins within 20 s and both continue.
- [ ] Reconnect timeout: leave it off > 20 s — the other player gets the match result / returns to the room, nothing hangs.
- [ ] Rematch and "Leave room" both work afterwards.
- [ ] Lone player + server CPU (Add CPU opponent) starts and finishes a match.

## 4. Controls
- [ ] Keyboard P1 and P2 (local 2P), key rebinding in Settings.
- [ ] Gamepad: face buttons, d-pad/stick, Start pauses.
- [ ] Touch (iPad): stick, 4 buttons, SP easy-special button, double-SP super, "II" pause, Touch layout editor.

## 5. Every character × every special (manual, Training mode, both facings)
Tick when the move comes out from the keyboard motion AND from the touch SP button where applicable.

#### Bolt Brickley
- [ ] Rivet Shot (`rivetShot.L`, special)
- [ ] Rivet Shot (`rivetShot.H`, special)
- [ ] Jackhammer Rise (`jackhammerRise.L`, special)
- [ ] Jackhammer Rise (`jackhammerRise.H`, special)
- [ ] Hard Hat Hop (`hardHatHop.L`, special)
- [ ] Hard Hat Hop (`hardHatHop.H`, special)
- [ ] Demolition Drive (`demolitionDrive`, super)
#### Volt Vance
- [ ] Static Spark (`staticSpark.L`, special)
- [ ] Static Spark (`staticSpark.H`, special)
- [ ] Coil Whip (`coilWhip.L`, special)
- [ ] Coil Whip (`coilWhip.H`, special)
- [ ] Live Wire Hop (`liveWireHop.L`, special)
- [ ] Live Wire Hop (`liveWireHop.H`, special)
- [ ] Overload (`overload`, super)
#### Chompa
- [ ] Gulp Grab (`gulpGrab.L`, special)
- [ ] Gulp Grab (`gulpGrab.H`, special)
- [ ] Egg Lob (`eggLob.L`, special)
- [ ] Egg Lob (`eggLob.H`, special)
- [ ] Tail Spin (`tailSpin.L`, special)
- [ ] Tail Spin (`tailSpin.H`, special)
- [ ] Stampede Roll (`stampedeRoll`, super)
#### Kaze
- [ ] Shuriken Fan (`shurikenFan.L`, special)
- [ ] Shuriken Fan (`shurikenFan.H`, special)
- [ ] Air Shuriken (`airShuriken.L`, special)
- [ ] Air Shuriken (`airShuriken.H`, special)
- [ ] Smoke Step (`smokeStep.L`, special)
- [ ] Smoke Step (`smokeStep.H`, special)
- [ ] Rising Crane (`risingCrane.L`, special)
- [ ] Rising Crane (`risingCrane.H`, special)
- [ ] Thousand Shadows (`thousandShadows`, super)
#### Bao
- [ ] Jade Palm (`jadePalm.L`, special)
- [ ] Jade Palm (`jadePalm.H`, special)
- [ ] Rolling Bun (`rollingBun.L`, special)
- [ ] Rolling Bun (`rollingBun.H`, special)
- [ ] Bamboo Counter (`bambooCounter.L`, special)
- [ ] Bamboo Counter (`bambooCounter.H`, special)
- [ ] Dragon Dumpling (`dragonDumpling`, super)

## 6. Flow
- [ ] Title → every menu entry opens and Back returns.
- [ ] Versus CPU on easy/normal/hard: full match to the results screen; Rematch / Character select / Title.
- [ ] Pause (Esc / Start / II): resume, restart, character select, title.
- [ ] How to Play and Settings read correctly at iPad size.

## 7. Sign-off
- [ ] All boxes above ticked or explicitly NOT RUN with a reason.
- [ ] `pnpm verify` and `pnpm test:browser` green on the release commit.
