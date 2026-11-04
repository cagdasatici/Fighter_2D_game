import { CHARS, type CharId, type StageId } from '@kb/shared';
import { HEIGHT, WIDTH } from '../render/Canvas.js';
import { SKINS } from '../render/Gallery.js';
import { drawPuppet, drawShadow } from '../render/Puppet.js';
import { drawStage } from '../render/Stage.js';
import { getPose } from '../render/poses.js';
import { el } from './dom.js';

/** Spec §15: the VS screen lasts 90 frames. */
export const VS_FRAMES = 90;

export function showVs(root: HTMLElement, chars: [CharId, CharId]): () => void {
  const panel = el('section', { class: 'kb-vs' }, [
    el('div', { class: 'kb-vs-name kb-left' }, [CHARS[chars[0]].name]),
    el('div', { class: 'kb-vs-mark' }, ['VS']),
    el('div', { class: 'kb-vs-name kb-right' }, [CHARS[chars[1]].name]),
  ]);
  root.replaceChildren(panel);
  return () => panel.remove();
}

/** Both puppets in the victory pose over the dimmed stage; `t` = frames elapsed. */
export function drawVs(ctx: CanvasRenderingContext2D, chars: [CharId, CharId], stage: StageId, t: number): void {
  drawStage(ctx, stage, { camX: 0, camY: 0, t });
  ctx.fillStyle = 'rgba(10,10,30,0.55)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const slide = Math.max(0, 1 - t / 20) * 260;
  // Diagonal split panels in each fighter's colour.
  for (const side of [0, 1] as const) {
    const off = side === 0 ? -slide : slide;
    ctx.save(); ctx.translate(off, 0); ctx.globalAlpha = 0.4;
    ctx.beginPath();
    if (side === 0) { ctx.moveTo(0, 0); ctx.lineTo(350, 0); ctx.lineTo(290, HEIGHT); ctx.lineTo(0, HEIGHT); }
    else { ctx.moveTo(350, 0); ctx.lineTo(WIDTH, 0); ctx.lineTo(WIDTH, HEIGHT); ctx.lineTo(290, HEIGHT); }
    ctx.closePath(); ctx.fillStyle = SKINS[chars[side]].accent; ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(350, 0); ctx.lineTo(290, HEIGHT); ctx.stroke();
  drawShadow(ctx, 160 - slide, 330, 0, 60); drawShadow(ctx, 480 + slide, 330, 0, 60);
  drawPuppet(ctx, SKINS[chars[0]], getPose('victory'), 160 - slide, 330, 1, { frame: t, scale: 1.5, mood: 'fierce' });
  drawPuppet(ctx, SKINS[chars[1]], getPose('victory'), 480 + slide, 330, -1, { frame: t, scale: 1.5, mood: 'fierce' });
}
