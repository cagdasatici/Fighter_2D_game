import { DOWN, numpad } from "./buttons.js";
import type { HistoryOwner } from "./history.js";
import { inputAt } from "./history.js";

/** Spec §5.3 motion ids (charge is tracked separately via updateCharge/chargeReady). */
export type MotionId = "qcf" | "qcb" | "dp" | "dqcf" | "dd" | "spin";
export type RequestId = MotionId | "charge";

export const MOTION_WINDOW: Readonly<Record<MotionId, number>> = {
  qcf: 12, qcb: 12, dp: 14, dqcf: 24, dd: 14, spin: 30,
};
export const CHARGE_FRAMES = 40;
export const CHARGE_GRACE = 10;

// 0 in a sequence = "5": any direction without DOWN (used by dd).
const SEQ: Readonly<Record<Exclude<MotionId, "spin">, readonly number[]>> = {
  qcf: [2, 3, 6], qcb: [2, 1, 4], dp: [6, 2, 3], dqcf: [2, 3, 6, 2, 3, 6], dd: [2, 0, 2],
};

/** Diagonal tolerance: 2 ~ 1/3, 6 ~ 3/9, 4 ~ 1/7; everything else exact. */
function matches(req: number, b: number, np: number): boolean {
  switch (req) {
    case 0: return (b & DOWN) === 0;
    case 2: return np === 2 || np === 1 || np === 3;
    case 6: return np === 6 || np === 3 || np === 9;
    case 4: return np === 4 || np === 1 || np === 7;
    default: return np === req;
  }
}

/**
 * Frames ago of the matched final step, or -1. Scans backward from the newest frame;
 * each step uses its own frame (strictly older than the next step's frame).
 */
function motionAgo(f: HistoryOwner, facing: 1 | -1, motion: MotionId, frames: number): number {
  const w = frames < f.history.length ? frames : f.history.length;
  if (motion === "spin") {
    let seen = 0, first = -1;
    for (let ago = 0; ago < w; ago++) {
      const np = numpad(inputAt(f, ago), facing);
      const before = seen;
      if (matches(4, 0, np)) seen |= 1;
      if (matches(2, 0, np)) seen |= 2;
      if (matches(6, 0, np)) seen |= 4;
      if (np === 8) seen |= 8;
      if (first < 0 && seen !== before) first = ago;
      if (seen === 15) return first;
    }
    return -1;
  }
  const seq = SEQ[motion];
  let idx = seq.length - 1, last = -1;
  for (let ago = 0; ago < w; ago++) {
    const b = inputAt(f, ago);
    if (matches(seq[idx] ?? -1, b, numpad(b, facing))) {
      if (idx === seq.length - 1) last = ago;
      idx--;
      if (idx < 0) return last;
    }
  }
  return -1;
}

/** True when `motion` appears in order within the last `frames` frames (spec "window") (ending at the newest frame). */
export function detectMotion(f: HistoryOwner, facing: 1 | -1, motion: MotionId, frames: number): boolean {
  return motionAgo(f, facing, motion, frames) >= 0;
}

export interface ChargeOwner extends HistoryOwner { chargeBack: number; chargeGrace: number }

/** Call once per frame after pushInput. Back held → count up; release keeps a full charge alive for CHARGE_GRACE frames. */
export function updateCharge(f: ChargeOwner, facing: 1 | -1): void {
  const np = numpad(inputAt(f, 0), facing);
  if (np === 1 || np === 4 || np === 7) {
    if (f.chargeBack < CHARGE_FRAMES) f.chargeBack++;
    return;
  }
  if (f.chargeBack >= CHARGE_FRAMES) f.chargeGrace = CHARGE_GRACE;
  else if (f.chargeGrace > 0) f.chargeGrace--;
  f.chargeBack = 0;
}

/** Charge is complete (still holding back) or within the post-release grace. */
export function chargeReady(f: ChargeOwner): boolean {
  return f.chargeBack >= CHARGE_FRAMES || f.chargeGrace > 0;
}

/**
 * §5.3 motion priority (button/throw/normal resolution belongs to the sim):
 * dqcf → spin → dp → qcf/qcb (most recent final step; tie → qcf) → charge (ready + 6 now) → dd.
 */
export function resolveRequest(f: ChargeOwner, facing: 1 | -1): RequestId | null {
  if (detectMotion(f, facing, "dqcf", MOTION_WINDOW.dqcf)) return "dqcf";
  if (detectMotion(f, facing, "spin", MOTION_WINDOW.spin)) return "spin";
  if (detectMotion(f, facing, "dp", MOTION_WINDOW.dp)) return "dp";
  const a = motionAgo(f, facing, "qcf", MOTION_WINDOW.qcf);
  const b = motionAgo(f, facing, "qcb", MOTION_WINDOW.qcb);
  if (a >= 0 && (b < 0 || a <= b)) return "qcf";
  if (b >= 0) return "qcb";
  const np = numpad(inputAt(f, 0), facing);
  if (chargeReady(f) && (np === 6 || np === 3 || np === 9)) return "charge";
  if (detectMotion(f, facing, "dd", MOTION_WINDOW.dd)) return "dd";
  return null;
}
