import { at, inFrame, oval, poly, rig, stroke, torsoCapsule } from '../Puppet.js';
import type { Skin } from './types.js';

// Volt Vance — tall teal jumpsuit, goggles on forehead, yellow rubber gloves, coiled cable (docs/characters.md §3).
const TEAL = '#1fa39a', SKIN = '#f0c09a', HAIR = '#24324a', CABLE = '#ff8c1a';
export const VOLT_SKIN: Skin = {
  id: 'volt', hipHeight: 56, outline: '#1b1b2a', accent: '#7fd4ff', torsoLean: 0,
  bones: rig({
    torso: 40, head: 13, uArm: 24, fArm: 22, thigh: 28, shin: 28, foot: 10, fist: 0,
    wTorso: 22, wArm: 9, wLeg: 10, wFist: 11, wFoot: 10,
    c: { torso: TEAL, head: SKIN, uArm: TEAL, fArm: TEAL, fist: '#ffe14d', thigh: TEAL, shin: TEAL, foot: '#222228' },
  }),
  drawBack(ctx, b) {
    const [cx, cy] = at(b.torso, 6, -12);
    ctx.strokeStyle = CABLE; ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(cx - i * 2, cy + i * 3, 9, 6, 0.3, 0, Math.PI * 2); ctx.stroke(); }
  },
  drawTorso(ctx, b) {
    torsoCapsule(ctx, this, b);
    stroke(ctx, [at(b.torso, 6, 2), at(b.torso, 34, 2)], 1.5, '#137a73');     // zip line
    const [nx, ny] = at(b.torso, 39, 0);
    oval(ctx, nx, ny, 9, 4, b.torso.a - 90 + 90, '#f4f4f4');                     // white collar
    const p = (al: number, s: number): [number, number] => at(b.torso, al, s);
    poly(ctx, [p(33, -4), p(28, 1), p(28, -2), p(22, 3), p(27, -3), p(27, 0)], '#ffe14d'); // plain zigzag patch
  },
  drawHead(ctx, b) {
    const h = b.head;
    inFrame(ctx, h.x1, h.y1, h.a, () => {
      for (const [x, s] of [[-8, -1], [-2, 1], [5, 0]] as const) poly(ctx, [[x - 6, -9], [x + 6, -9], [x + s * 3, -21]], HAIR);
      oval(ctx, 0, 1, 12, 14, 0, SKIN);
      oval(ctx, 12, 3, 2.5, 3, 0, '#e0a47e');                                     // nose
      oval(ctx, 7, -1, 1.6, 2.2, 0, '#1b1b2a', false);
      stroke(ctx, [[3, -6], [7, -4], [11, -6]], 1.8, HAIR);                      // worried brow (up in the middle)
      stroke(ctx, [[7, 9], [10, 9]], 1.6, '#7a3a30');                            // small mouth
      for (const gx of [-1, 8]) { oval(ctx, gx, -10, 4.5, 4.5, 0, '#8d95a0'); oval(ctx, gx, -10, 2.8, 2.8, 0, '#7fd4ff', false); }
      stroke(ctx, [[-10, -10], [-5.5, -10]], 2, '#555c66');                      // goggle strap
    });
  },
};
