import { at, eye, inFrame, oval, poly, rig, rotOf, setLidColor, stroke } from '../Puppet.js';
import type { Seg, Skin } from './types.js';

// Chompa — plum dino, cream belly plate, three orange back spikes, stubby tail, hinged jaw (docs/characters.md §4).
const PLUM = '#8c2f5a', CREAM = '#f3d9a4', SPIKE = '#ffb02e';
const spike = (ctx: CanvasRenderingContext2D, s: Seg, along: number, side: number, size: number): void => {
  const base0 = at(s, along - size * 0.6, side), base1 = at(s, along + size * 0.6, side), tip = at(s, along, side - size * 1.1);
  poly(ctx, [base0, tip, base1], SPIKE);
};
export const CHOMPA_SKIN: Skin = {
  id: 'chompa', hipHeight: 34, outline: '#1b1b2a', accent: '#ffb02e', torsoLean: 20,
  bones: rig({
    torso: 36, head: 12, uArm: 12, fArm: 10, thigh: 18, shin: 16, foot: 12, fist: 0,
    wTorso: 34, wArm: 8, wLeg: 16, wFist: 9, wFoot: 14,
    c: { torso: PLUM, head: PLUM, uArm: PLUM, fArm: PLUM, fist: PLUM, thigh: PLUM, shin: PLUM, foot: PLUM },
  }),
  tail: { len: 40, w0: 18, w1: 6, color: PLUM },
  drawBack(ctx, b) {
    spike(ctx, b.torso, 26, -15, 8); spike(ctx, b.torso, 10, -16, 9);
    if (b.tail) spike(ctx, b.tail, 14, -7, 6);
  },
  drawTorso(ctx, b) {
    const [cx, cy] = at(b.torso, 16, 0);
    oval(ctx, cx, cy, 25, 19, rotOf(b.torso.a), PLUM);
    const [bx, by] = at(b.torso, 15, 7);
    oval(ctx, bx, by, 18, 10, rotOf(b.torso.a), CREAM);
    for (const al of [6, 12, 18, 24]) stroke(ctx, [at(b.torso, al, 1), at(b.torso, al, 14)], 1.2, '#c9a978');
  },
  drawHead(ctx, b, info) {
    const h = b.head;
    inFrame(ctx, h.x1, h.y1, h.a, () => {
      poly(ctx, [[-14, -6], [-6, -11], [-9, -22]], SPIKE);                       // head spike
      ctx.save(); ctx.translate(-2, 4); ctx.rotate(info.jawOpen * Math.PI / 180);   // lower jaw bone, hinge at back
      oval(ctx, 13, 2, 16, 5.5, 0, PLUM);
      for (const x of [8, 15, 22]) poly(ctx, [[x - 2, -3], [x + 2, -3], [x, -6.5]], '#fff8e8', false);
      ctx.restore();
      oval(ctx, 6, -3, 18, 11, 0, PLUM);                                          // big oval head (34 long)
      oval(ctx, 21, -6, 1.3, 1.3, 0, '#1b1b2a', false); oval(ctx, 17, -7, 1.3, 1.3, 0, '#1b1b2a', false); // nostrils
      for (const x of [9, 14, 19]) poly(ctx, [[x - 2, 7], [x + 2, 7], [x, 10.5]], '#fff8e8', false); // upper teeth
      setLidColor(PLUM); eye(ctx, 4.5, -7, 4.6, info.mood);                        // big shared-style eye
      stroke(ctx, [[-1, -12], [9, -9]], 2.5, '#4a1530');                          // angry-cute brow
    });
  },
  drawFist(ctx, s, back) {
    const c = back ? '#692244' : PLUM;
    oval(ctx, s.x0, s.y0, 4.5, 4.5, 0, c);
    for (const d of [-3, 0, 3]) { const [x, y] = at({ ...s, x0: s.x0, y0: s.y0 }, 5, d); oval(ctx, x, y, 1.6, 1.6, 0, CREAM); }
  },
  drawFoot(ctx, s, back) {
    const c = back ? '#692244' : PLUM;
    oval(ctx, (s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2, 10, 6, rotOf(s.a), c);
    for (const d of [-4, 0, 4]) { const [x, y] = at(s, 14, d); oval(ctx, x, y, 2.4, 2.4, 0, CREAM); }
  },
};
