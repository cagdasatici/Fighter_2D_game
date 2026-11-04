import { at, capsule, inFrame, oval, rig, rotOf, stroke } from '../Puppet.js';
import type { Skin } from './types.js';

// Bao — brown bear, forest-green sleeveless vest, gold knots, white sash, steamer basket (docs/characters.md §6).
const FUR = '#8a5a32', LIGHT = '#d9b38c', VEST = '#2f6b3a', GOLD = '#e2b53c', SASH = '#f4f1e8', PANTS = '#6e6a64';
export const BAO_SKIN: Skin = {
  id: 'bao', hipHeight: 40, outline: '#1b1b2a', accent: '#3ddc97', torsoLean: 0,
  bones: rig({
    torso: 36, head: 17, uArm: 20, fArm: 18, thigh: 20, shin: 18, foot: 11, fist: 0,
    wTorso: 40, wArm: 14, wLeg: 15, wFist: 15, wFoot: 13,
    c: { torso: VEST, head: FUR, uArm: FUR, fArm: FUR, fist: FUR, thigh: PANTS, shin: PANTS, foot: '#3a3530' },
  }),
  drawBack(ctx, b) {
    const [x, y] = at(b.torso, 2, -20);
    oval(ctx, x, y, 9, 7, 0, '#c9a35e');
    ctx.fillStyle = '#c9a35e'; ctx.fillRect(x - 9, y - 7, 18, 7);
    stroke(ctx, [[x - 9, y - 3], [x + 9, y - 3]], 1.2, '#8a6a32');
    stroke(ctx, [[x - 9, y + 1], [x + 9, y + 1]], 1.2, '#8a6a32');
    oval(ctx, x, y - 7, 9, 3, 0, '#d9b874');
  },
  drawTorso(ctx, b) {
    const [cx, cy] = at(b.torso, 18, 0), r = rotOf(b.torso.a);
    oval(ctx, cx, cy, 26, 22, r, VEST);                                           // round body 44×52
    const [bx, by] = at(b.torso, 17, 9);
    oval(ctx, bx, by, 17, 11, r, LIGHT);                                          // belly overlay
    for (const al of [26, 18, 10]) { const [x, y] = at(b.torso, al, 2); oval(ctx, x, y, 2.4, 2.4, 0, GOLD); }
    const [x0, y0] = at(b.torso, 2, -20), [x1, y1] = at(b.torso, 2, 20);
    capsule(ctx, { x0, y0, x1, y1 }, 8, SASH);                                    // wide white sash
  },
  drawHead(ctx, b) {
    const h = b.head;
    inFrame(ctx, h.x1, h.y1, h.a, () => {
      oval(ctx, -9, -14, 5.5, 5.5, 0, FUR); oval(ctx, -9, -14, 2.8, 2.8, 0, LIGHT, false);
      oval(ctx, 6, -15, 5.5, 5.5, 0, FUR); oval(ctx, 6, -15, 2.8, 2.8, 0, LIGHT, false);
      oval(ctx, 0, 0, 17, 16, 0, FUR);
      oval(ctx, 11, 5, 8, 6.5, 0, LIGHT);                                         // muzzle
      oval(ctx, 17, 2.5, 3, 2.3, 0, '#1b1b2a', false);                             // nose
      stroke(ctx, [[12, 9], [15, 10.5], [18, 9]], 1.4, '#4a2e1a');               // smile
      oval(ctx, 8, -4, 2.1, 2.6, 0, '#1b1b2a', false);
      oval(ctx, 8.7, -4.8, 0.8, 0.8, 0, '#ffffff', false);                          // friendly eye
      stroke(ctx, [[3, -9], [12, -9.5]], 3.2, '#4a2e1a');                         // thick eyebrow
    });
  },
  drawFoot(ctx, s, back) {
    oval(ctx, (s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2 + 1, 9, 5.5, rotOf(s.a), back ? '#2b2724' : '#3a3530');
    const [x, y] = at({ ...s, a: s.a - 90 }, 3);
    oval(ctx, x, y, 6, 3, rotOf(s.a + 90), back ? '#b6b3ab' : SASH);               // ankle wrap
  },
};
