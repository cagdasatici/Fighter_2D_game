import { describe, expect, it } from "vitest";
import { DOWN, LEFT, RIGHT, UP } from "../../packages/shared/src/input/buttons.js";
import { pushInput } from "../../packages/shared/src/input/history.js";
import {
  MOTION_WINDOW, chargeReady, detectMotion, resolveRequest, updateCharge, type MotionId,
} from "../../packages/shared/src/input/motion.js";

const mk = () => ({ history: new Array<number>(40).fill(0), historyHead: 0, chargeBack: 0, chargeGrace: 0 });
type F = ReturnType<typeof mk>;
/** numpad (relative to facing) → byte */
function byte(n: number, facing: 1 | -1): number {
  const fwd = facing === 1 ? RIGHT : LEFT, back = facing === 1 ? LEFT : RIGHT;
  const h = (n - 1) % 3, v = Math.floor((n - 1) / 3);
  return (h === 0 ? back : h === 2 ? fwd : 0) | (v === 0 ? DOWN : v === 2 ? UP : 0);
}
function feed(f: F, facing: 1 | -1, seq: number[], gap = 0): void {
  seq.forEach((n, i) => {
    pushInput(f, byte(n, facing));
    if (i < seq.length - 1) for (let g = 0; g < gap; g++) pushInput(f, byte(n, facing));
  });
}
/** Spread `seq` so first step is exactly `span` frames before last (inclusive span = span+1 frames). */
function spread(f: F, facing: 1 | -1, seq: number[], frames: number): void {
  const extra = frames - seq.length;
  pushInput(f, byte(seq[0]!, facing));
  for (let i = 0; i < extra; i++) pushInput(f, byte(5, facing));
  for (const n of seq.slice(1)) pushInput(f, byte(n, facing));
}

const SEQS: Record<MotionId, number[]> = {
  qcf: [2, 3, 6], qcb: [2, 1, 4], dp: [6, 2, 3], dqcf: [2, 3, 6, 2, 3, 6], dd: [2, 5, 2], spin: [4, 1, 2, 3, 6, 9, 8],
};
const OUT_OF_ORDER: Record<MotionId, number[]> = {
  qcf: [6, 3, 2], qcb: [4, 1, 2], dp: [3, 2, 6], dqcf: [6, 3, 2, 6, 3, 2], dd: [5, 2, 5], spin: [4, 1, 2, 3],
};

for (const facing of [1, -1] as const) {
  describe(`motions facing ${facing}`, () => {
    for (const id of Object.keys(SEQS) as MotionId[]) {
      it(`${id} valid passes`, () => {
        const f = mk(); feed(f, facing, SEQS[id]);
        expect(detectMotion(f, facing, id, MOTION_WINDOW[id])).toBe(true);
      });
      it(`${id} within window passes, window+1 frames fails`, () => {
        // spin's 4-step set: 1 also satisfies 4 via tolerance, so spread a cardinal-only circle.
        const seq = id === "spin" ? [8, 4, 2, 6] : SEQS[id];
        const ok = mk(); spread(ok, facing, seq, MOTION_WINDOW[id]);
        expect(detectMotion(ok, facing, id, MOTION_WINDOW[id])).toBe(true);
        const bad = mk(); spread(bad, facing, seq, MOTION_WINDOW[id] + 1);
        expect(detectMotion(bad, facing, id, MOTION_WINDOW[id])).toBe(false);
      });
      it(`${id} out-of-order fails`, () => {
        const f = mk(); feed(f, facing, OUT_OF_ORDER[id]);
        expect(detectMotion(f, facing, id, MOTION_WINDOW[id])).toBe(false);
      });
    }
    it("qcf with 1 instead of 3 fails", () => {
      const f = mk(); feed(f, facing, [2, 1, 6]);
      expect(detectMotion(f, facing, "qcf", 12)).toBe(false);
    });
    it("dp accepts 6,3,2,3", () => {
      const f = mk(); feed(f, facing, [6, 3, 2, 3]);
      expect(detectMotion(f, facing, "dp", 14)).toBe(true);
    });
    it("spin accepts both directions", () => {
      const a = mk(); feed(a, facing, [4, 1, 2, 3, 6, 9, 8]);
      expect(detectMotion(a, facing, "spin", 30)).toBe(true);
      const b = mk(); feed(b, facing, [6, 3, 2, 1, 4, 7, 8]);
      expect(detectMotion(b, facing, "spin", 30)).toBe(true);
    });
    const charge = (held: number, releaseFrames: number): boolean => {
      const f = mk();
      for (let i = 0; i < held; i++) { pushInput(f, byte(4, facing)); updateCharge(f, facing); }
      for (let i = 0; i < releaseFrames; i++) { pushInput(f, byte(i === releaseFrames - 1 ? 6 : 5, facing)); updateCharge(f, facing); }
      return chargeReady(f) && resolveRequest(f, facing) === "charge";
    };
    it("charge: 40 back frames works, 39 fails", () => {
      expect(charge(40, 1)).toBe(true);
      expect(charge(39, 1)).toBe(false);
    });
    it("charge: 6 on 10th frame after release works, 11th fails", () => {
      expect(charge(40, 10)).toBe(true);
      expect(charge(40, 11)).toBe(false);
    });
    it("resolveRequest prefers super over qcf", () => {
      const f = mk(); feed(f, facing, SEQS.dqcf);
      expect(detectMotion(f, facing, "qcf", 12)).toBe(true);
      expect(resolveRequest(f, facing)).toBe("dqcf");
    });
  });
}

describe("decision 0002: held diagonal is not a motion", () => {
  for (const facing of [1, -1] as const) {
    it(`holding 3 does not trigger qcf or dp (facing ${facing})`, () => {
      const f = mk();
      feed(f, facing, [3, 3, 3, 3, 3]);
      expect(detectMotion(f, facing, "qcf", 12)).toBe(false);
      expect(detectMotion(f, facing, "dp", 14)).toBe(false);
    });
    it(`real qcf and dp still work after the fix (facing ${facing})`, () => {
      const a = mk(); feed(a, facing, [2, 3, 6]);
      expect(detectMotion(a, facing, "qcf", 12)).toBe(true);
      const b = mk(); feed(b, facing, [6, 2, 3]);
      expect(detectMotion(b, facing, "dp", 14)).toBe(true);
    });
  }
});
