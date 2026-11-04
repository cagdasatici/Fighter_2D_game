import type { CharId } from '@kb/shared';
import { SKINS } from './Gallery.js';
import { drawPuppet, drawShadow } from './Puppet.js';
import { getPose, lerpPose } from './poses.js';

/** Title/menu line-up: the cast flanks the menu panel, gently breathing. `t` = render tick (decoration only). */
const LINEUP: readonly { id: CharId; x: number; facing: 1 | -1; scale: number }[] = [
  { id: 'chompa', x: 48, facing: 1, scale: 1.2 },
  { id: 'bolt', x: 150, facing: 1, scale: 1.3 },
  { id: 'kaze', x: 500, facing: -1, scale: 1.25 },
  { id: 'volt', x: 592, facing: -1, scale: 1.2 },
];
const IDLE = getPose('idle'), IDLE2 = getPose('idle2');

export function drawMenuArt(ctx: CanvasRenderingContext2D, t: number): void {
  LINEUP.forEach((c, i) => {
    const k = 0.5 + 0.5 * Math.sin(t / 30 + i * 1.3);
    drawShadow(ctx, c.x, 330, 0, 34 * c.scale);
    drawPuppet(ctx, SKINS[c.id], lerpPose(IDLE, IDLE2, k), c.x, 330, c.facing, { frame: t, scale: c.scale });
  });
  // Bao stands in the front row on the left.
  drawShadow(ctx, 100, 354, 0, 40);
  drawPuppet(ctx, SKINS.bao, lerpPose(IDLE, IDLE2, 0.5 + 0.5 * Math.sin(t / 26)), 100, 354, 1, { frame: t, scale: 1.1 });
}
