import { at, capsule, eye, inFrame, oval, poly, rig, setLidColor, stroke, torsoCapsule } from '../Puppet.js';
import type { Skin } from './types.js';

// Bolt Brickley — hard hat, hi-vis vest, olive cargo trousers, stubble (docs/characters.md §2).
const SKIN = '#e8a87c', VEST = '#ff7b1c', SILVER = '#e0e0e0', SHIRT = '#5d6670', HAT = '#ffcc1a';
export const BOLT_SKIN: Skin = {
  id: 'bolt', hipHeight: 44, outline: '#1b1b2a', accent: '#ffcc1a', torsoLean: 0,
  bones: rig({
    torso: 34, head: 15, uArm: 20, fArm: 18, thigh: 22, shin: 22, foot: 10, fist: 0,
    wTorso: 30, wArm: 11, wLeg: 13, wFist: 13, wFoot: 13,
    c: { torso: VEST, head: SKIN, uArm: SHIRT, fArm: SKIN, fist: '#9aa3ad', thigh: '#6b6b3a', shin: '#6b6b3a', foot: '#4a2f1b' },
  }),
  overrides: { 'move:6HP': { torso: 50, head: 20 } },
  drawTorso(ctx, b) {
    torsoCapsule(ctx, this, b);
    for (const side of [-6, 6]) stroke(ctx, [at(b.torso, 2, side), at(b.torso, 30, side)], 3, SILVER);
    capsule(ctx, { x0: at(b.torso, 30, -9)[0], y0: at(b.torso, 30, -9)[1], x1: at(b.torso, 30, 9)[0], y1: at(b.torso, 30, 9)[1] }, 6, SHIRT);
    const [x0, y0] = at(b.torso, -1, -15), [x1, y1] = at(b.torso, -1, 15);
    capsule(ctx, { x0, y0, x1, y1 }, 5, '#c9a46a');
    for (const side of [-8, 0, 8]) { const [px, py] = at(b.torso, 1, side); oval(ctx, px, py, 2.6, 3.2, 0, '#7a5a2e'); }
  },
  drawHead(ctx, b, info) {
    const h = b.head;
    inFrame(ctx, h.x1, h.y1, h.a, () => {
      oval(ctx, 0, 0, 15, 15, 0, SKIN);
      oval(ctx, 15, 2, 3.5, 3, 0, '#d98f62');                        // nose
      for (const [x, y] of [[4, 8], [8, 9], [12, 7], [6, 12], [10, 12], [1, 11], [13, 4]] as const) oval(ctx, x, y, 0.9, 0.9, 0, '#3a2a20', false);
      if (info.mood === 'hurt') oval(ctx, 9, 7, 2.6, 2, 0, '#5a2e1e', false);
      else stroke(ctx, info.mood === 'fierce' ? [[5, 7], [11, 6]] : [[5, 6], [8, 7.5], [11, 6]], 1.6, '#5a2e1e'); // grin
      setLidColor(SKIN); eye(ctx, 8, -2.5, 3.2, info.mood);
      stroke(ctx, [[3, -8], [12, -7]], 3.5, '#3a2a20');                // big eyebrow
      oval(ctx, -9, 1, 3, 4, 0, '#d98f62');                            // ear
      ctx.beginPath(); ctx.ellipse(0, -5, 16.5, 14, 0, Math.PI, 0); ctx.closePath();
      ctx.fillStyle = HAT; ctx.fill(); ctx.strokeStyle = info.outline; ctx.lineWidth = 2; ctx.stroke();
      poly(ctx, [[-16, -6], [24, -6], [24, -2], [-16, -2]], HAT);       // brim
      stroke(ctx, [[0, -18], [0, -7]], 2, '#e0b000');                  // crown ridge
      stroke(ctx, [[-11, -9], [-8, -15], [-3, -18.5]], 2.2, '#fff2a8');  // hat shine
      const lit = info.meterFull && info.frame % 60 < 30;
      oval(ctx, 0, -21, 3.5, 3, 0, lit ? '#fff3a0' : '#ff7b1c');      // warning lamp
    });
  },
};
