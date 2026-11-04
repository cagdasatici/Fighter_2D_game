import { CHARS, type MatchState } from '@kb/shared';
import { HEIGHT, WIDTH } from '../render/Canvas.js';
import { SKINS } from '../render/Gallery.js';
import { drawPuppet, drawShadow } from '../render/Puppet.js';
import { drawStage } from '../render/Stage.js';
import { getPose } from '../render/poses.js';
import { arrowNav, button, el, screen } from './dom.js';

export type ResultChoice = 'rematch' | 'select' | 'title';

export function resultText(s: MatchState, cpuSide: 0 | 1 | null): string {
  if (s.winner === null) return 'Draw';
  const name = CHARS[s.fighters[s.winner].char].name;
  if (cpuSide === null) return `P${s.winner + 1} ${name} wins!`;
  return s.winner === cpuSide ? `${name} (CPU) wins` : `You win with ${name}!`;
}

export function showResults(root: HTMLElement, s: MatchState, cpuSide: 0 | 1 | null, pick: (c: ResultChoice) => void): () => void {
  const menu = el('div', { class: 'kb-menu' }, [
    button('Rematch', () => pick('rematch')), button('Character Select', () => pick('select')), button('Title', () => pick('title'))]);
  const rounds = `Rounds ${s.fighters[0].wins} – ${s.fighters[1].wins}`;
  const panel = screen(resultText(s, cpuSide), [el('p', {}, [rounds]), menu], 'kb-results');
  root.replaceChildren(panel);
  menu.querySelector('button')?.focus();
  const stop = arrowNav(menu);
  return () => { stop(); panel.remove(); };
}

/** Winner puppet in `victory` (both on a draw) over the stage. */
export function drawResults(ctx: CanvasRenderingContext2D, s: MatchState, t: number): void {
  drawStage(ctx, s.stage, { camX: 0, camY: 0, t });
  ctx.fillStyle = 'rgba(10,10,30,0.45)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  if (s.winner === null) {
    drawPuppet(ctx, SKINS[s.fighters[0].char], getPose('idle'), 110, 330, 1, { frame: t, scale: 1.6 });
    drawPuppet(ctx, SKINS[s.fighters[1].char], getPose('idle'), 530, 330, -1, { frame: t, scale: 1.6 });
  } else {
    const skin = SKINS[s.fighters[s.winner].char];
    // Spotlight cone behind the winner.
    ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = skin.accent;
    ctx.beginPath(); ctx.moveTo(90, 0); ctx.lineTo(170, 0); ctx.lineTo(240, 340); ctx.lineTo(20, 340); ctx.closePath(); ctx.fill();
    ctx.restore();
    drawShadow(ctx, 130, 330, 0, 60);
    drawPuppet(ctx, skin, getPose('victory'), 130, 330, 1, { frame: t, scale: 2 });
  }
}
