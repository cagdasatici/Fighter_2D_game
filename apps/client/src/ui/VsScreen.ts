import { CHARS, type CharId, type StageId } from '@kb/shared';
import { HEIGHT, WIDTH } from '../render/Canvas.js';
import { SKINS } from '../render/Gallery.js';
import { drawPuppet } from '../render/Puppet.js';
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
  const slide = Math.max(0, 1 - t / 20) * 200;
  drawPuppet(ctx, SKINS[chars[0]], getPose('victory'), 170 - slide, 300, 1, { frame: t });
  drawPuppet(ctx, SKINS[chars[1]], getPose('victory'), 470 + slide, 300, -1, { frame: t });
}
