import { at, capsule, inFrame, oval, rig, stroke, torsoCapsule } from '../Puppet.js';
import type { Skin } from './types.js';

// Kaze — indigo wrap suit, charcoal lower-face mask, red scarf, silver swirl plate, straw wraps (docs/characters.md §5).
const INDIGO = '#2b2d6e', MASK = '#1b1b2a', WRAP = '#d8c99b';
export const KAZE_SKIN: Skin = {
  id: 'kaze', hipHeight: 50, outline: '#1b1b2a', accent: '#e63946', torsoLean: 0,
  bones: rig({
    torso: 34, head: 13, uArm: 21, fArm: 19, thigh: 25, shin: 25, foot: 10, fist: 0,
    wTorso: 20, wArm: 9, wLeg: 10, wFist: 10, wFoot: 9,
    c: { torso: INDIGO, head: INDIGO, uArm: INDIGO, fArm: INDIGO, fist: '#c9a98a', thigh: INDIGO, shin: WRAP, foot: '#4a4a52' },
  }),
  scarf: { segLen: 12, width: 7, color: '#e63946' },
  drawTorso(ctx, b) {
    torsoCapsule(ctx, this, b);
    stroke(ctx, [at(b.torso, 32, -8), at(b.torso, 12, 8)], 2, '#3d4090');        // wrap fold
    const [x0, y0] = at(b.torso, 1, -11), [x1, y1] = at(b.torso, 1, 11);
    capsule(ctx, { x0, y0, x1, y1 }, 4, '#1b1b2a');                               // belt
    const [nx, ny] = at(b.torso, 34, 0);
    oval(ctx, nx, ny, 7, 4, 0, '#e63946');                                        // scarf knot
  },
  drawHead(ctx, b, info) {
    const h = b.head;
    inFrame(ctx, h.x1, h.y1, h.a, () => {
      oval(ctx, 0, 0, 13, 13, 0, INDIGO);
      ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 13, 13, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = MASK; ctx.fillRect(-14, 1, 30, 14);                       // lower-face mask
      ctx.restore();
      oval(ctx, 1, -8, 10, 3.5, 0, '#c8ccd6');                                    // silver forehead plate
      ctx.beginPath();
      for (let i = 0; i <= 30; i++) { const t = i / 30 * Math.PI * 3, r = 0.4 + i / 30 * 2.6; const x = 4 + Math.cos(t) * r, y = -8 + Math.sin(t) * r * 0.8; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = '#5a6070'; ctx.lineWidth = 0.8; ctx.stroke();               // 1.5-turn wind swirl
      if (info.mood === 'hurt') stroke(ctx, [[3, -4], [8, -2], [3, 0]], 1.6, '#ffffff'); // squeezed shut
      else {
        stroke(ctx, [[3, -2], [11, -3]], 2.6, '#ffffff');                          // sharp eye slit
        oval(ctx, 8.5, -2.6, 1.1, 1.1, 0, '#11121e', false);                       // pupil
        stroke(ctx, [[2, -4.5], [11, info.mood === 'fierce' ? -4 : -5.5]], 1.4, '#11121e');
      }
    });
  },
  drawFist(ctx, s, back) {
    oval(ctx, s.x0, s.y0, 5, 5, 0, back ? '#97806a' : '#c9a98a');
    const [x, y] = at({ ...s, a: s.a + 180 }, 4);
    oval(ctx, x, y, 5, 3, s.a, back ? '#a2977a' : WRAP);                           // wrist wrap
  },
};
