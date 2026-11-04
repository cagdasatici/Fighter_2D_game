import { CHARS } from "../chars/index.js";
import { idiv } from "../fixed.js";
import { UP, numpad, type InputByte } from "../input/buttons.js";
import { inputAt } from "../input/history.js";
import {
  AIR_JUMP_MIN_VY, AIR_JUMP_VX_PERCENT, AIR_JUMP_VY, DASH_WINDOW, JUMP_SQUAT, LANDING_RECOVERY,
} from "./constants.js";
import type { Fighter, FState } from "./types.js";

export function setState(f: Fighter, s: FState): void {
  if (f.state !== s) { f.state = s; f.stateFrame = 1; }
}

/** Step A (spec §8): face the opponent in idle/walk/crouch/land and on the frame jumpSquat ends. */
export function updateFacing(f: Fighter, opp: Fighter): void {
  const st = f.state;
  const ok = st === "idle" || st === "walkF" || st === "walkB" || st === "crouch" || st === "land"
    || (st === "jumpSquat" && f.stateFrame + 1 > JUMP_SQUAT);
  if (!ok || opp.x === f.x) return;
  f.facing = opp.x > f.x ? 1 : -1;
}

/** Horizontal part of a numpad direction: -1 back, 0, +1 forward. */
function horiz(dir: number): number { return dir % 3 === 0 ? 1 : dir % 3 === 1 ? -1 : 0; }

/** 6,5,6 (or 4,5,4): `want` now and not last frame, a 5 before that, and `want` before the 5, within DASH_WINDOW. */
function dashInput(f: Fighter, want: 4 | 6): boolean {
  if (numpad(inputAt(f, 0), f.facing) !== want || numpad(inputAt(f, 1), f.facing) === want) return false;
  let seenNeutral = false;
  for (let ago = 1; ago <= DASH_WINDOW; ago++) {
    const d = numpad(inputAt(f, ago), f.facing);
    if (!seenNeutral) { if (d === 5) seenNeutral = true; else return false; }
    else if (d === want) return true;
    else if (d !== 5) return false;
  }
  return false;
}

function actionable(f: Fighter, input: InputByte): void {
  const c = CHARS[f.char];
  const dir = numpad(input, f.facing);
  f.crouching = false;
  if (dir >= 7) { setState(f, "jumpSquat"); f.vx = 0; return; }
  if (dashInput(f, 6)) { setState(f, "dashF"); f.vx = c.dashFwd.speed * f.facing; return; }
  if (dashInput(f, 4)) {
    setState(f, "dashB"); f.vx = -c.dashBack.speed * f.facing;
    f.invuln = "strike"; f.invulnFrames = c.dashBack.invuln; return;
  }
  if (dir <= 3) { setState(f, "crouch"); f.crouching = true; f.vx = 0; return; }
  if (dir === 6) { setState(f, "walkF"); f.vx = c.walkFwd * f.facing; return; }
  if (dir === 4) { setState(f, "walkB"); f.vx = -c.walkBack * f.facing; return; }
  setState(f, "idle"); f.vx = 0;
}

/** Step B (spec §8.1), movement states only (S4). Attacks arrive in S5. */
export function stateMachine(f: Fighter, _opp: Fighter, input: InputByte): void {
  const c = CHARS[f.char];
  f.stateFrame++;
  f.gravityScale = 100;
  if (f.invulnFrames > 0) { f.invulnFrames--; if (f.invulnFrames === 0) f.invuln = "none"; }
  switch (f.state) {
    case "jumpSquat": {
      if (f.stateFrame <= JUMP_SQUAT) return;
      // Direction comes from the frame the jump was input (JUMP_SQUAT frames ago).
      const h = horiz(numpad(inputAt(f, JUMP_SQUAT), f.facing));
      setState(f, "air");
      f.airborne = true; f.vy = c.jumpVy; f.vx = h * c.jumpVx * f.facing;
      return;
    }
    case "air": {
      const up = (inputAt(f, 0) & UP) !== 0 && (inputAt(f, 1) & UP) === 0;
      if (up && f.airJumps < c.airJumpMax && f.vy < AIR_JUMP_MIN_VY) {
        const h = horiz(numpad(input, f.facing));
        f.airJumps++;
        f.vy = AIR_JUMP_VY;
        f.vx = h * idiv(c.jumpVx * AIR_JUMP_VX_PERCENT, 100) * f.facing;
      }
      return;
    }
    case "land":
      if (f.stateFrame <= LANDING_RECOVERY) return;
      actionable(f, input); return;
    case "dashF":
      if (f.stateFrame <= c.dashFwd.frames) return;
      actionable(f, input); return;
    case "dashB":
      if (f.stateFrame <= c.dashBack.frames) return;
      actionable(f, input); return;
    case "idle": case "walkF": case "walkB": case "crouch":
      actionable(f, input); return;
    default:
      return; // non-movement states are S5+
  }
}
