import type { CharId } from '@kb/shared';
import { drawPuppet } from './Puppet.js';
import { getPose } from './poses.js';
import { BAO_SKIN } from './skins/bao.js';
import { BOLT_SKIN } from './skins/bolt.js';
import { CHOMPA_SKIN } from './skins/chompa.js';
import { KAZE_SKIN } from './skins/kaze.js';
import type { Skin } from './skins/types.js';
import { VOLT_SKIN } from './skins/volt.js';

export const SKINS: Record<CharId, Skin> = { bolt: BOLT_SKIN, volt: VOLT_SKIN, chompa: CHOMPA_SKIN, kaze: KAZE_SKIN, bao: BAO_SKIN };
export const GALLERY_POSES = ['idle', 'walk2', 'crouch', 'jumpTuck', 'blockHigh', 'hitHigh', 'jab', 'strong', 'roundhouse', 'sweep', 'rise', 'victory'] as const;

/** `/?gallery` dev page (S9 art checkpoint): 5 characters × 12 key poses. Static; no loop to clean up. */
export function showGallery(canvas: HTMLCanvasElement): void {
  const CW = 110, CH = 150, LEFT = 80, TOP = 28;
  const W = LEFT + CW * GALLERY_POSES.length, H = TOP + CH * 5;
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = W * dpr; canvas.height = H * dpr;
  Object.assign(canvas.style, { width: `${W}px`, height: `${H}px`, display: 'block', position: 'static' });
  document.body.style.overflow = 'auto';
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#f2efe6'; ctx.fillRect(0, 0, W, H);
  ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#333';
  GALLERY_POSES.forEach((p, i) => ctx.fillText(p, LEFT + CW * i + CW / 2, 18));
  (Object.keys(SKINS) as CharId[]).forEach((id, r) => {
    const gy = TOP + CH * r + CH - 14;
    ctx.fillStyle = r % 2 ? '#e8e4d8' : '#efebe0'; ctx.fillRect(0, TOP + CH * r, W, CH);
    ctx.fillStyle = '#333'; ctx.textAlign = 'left'; ctx.font = 'bold 13px system-ui'; ctx.fillText(id, 10, gy - 60);
    ctx.strokeStyle = '#b9b2a0'; ctx.beginPath(); ctx.moveTo(LEFT, gy); ctx.lineTo(W, gy); ctx.stroke();
    GALLERY_POSES.forEach((p, c) => drawPuppet(ctx, SKINS[id], getPose(p), LEFT + CW * c + CW / 2 - 6, gy, 1, { frame: 0, meterFull: true }));
  });
}
