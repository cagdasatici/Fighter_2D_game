import { CHARS, type CharId, type StageId } from '@kb/shared';
import { SKINS } from '../render/Gallery.js';
import { drawPuppet } from '../render/Puppet.js';
import { getPose } from '../render/poses.js';
import { button, el, screen } from './dom.js';
import type { KeyMap } from './Settings.js';

export const ROSTER: readonly CharId[] = ['bolt', 'volt', 'chompa', 'kaze', 'bao'];
/** characters.md §7 (display only). */
export const STATS: Readonly<Record<CharId, { power: number; speed: number; range: number; tag: string }>> = {
  bolt: { power: 3, speed: 3, range: 3, tag: 'All-rounder' },
  volt: { power: 2, speed: 3, range: 5, tag: 'Zoner' },
  chompa: { power: 5, speed: 1, range: 2, tag: 'Grappler' },
  kaze: { power: 2, speed: 5, range: 2, tag: 'Rushdown' },
  bao: { power: 4, speed: 2, range: 3, tag: 'Counter-heavy' },
};
/** characters.md §8. */
export const HOME_STAGE: Readonly<Record<CharId, StageId>> = { bolt: 'rooftop', volt: 'rooftop', kaze: 'bamboo', bao: 'bamboo', chompa: 'volcano' };
export const STAGES: readonly StageId[] = ['rooftop', 'bamboo', 'volcano'];

export interface CharSelectResult { chars: [CharId, CharId]; stage: StageId }
export interface CharSelectOpts {
  twoHumans: boolean; keys: [KeyMap, KeyMap]; initial: [CharId, CharId];
  done: (r: CharSelectResult) => void; back: () => void;
}

function portrait(id: CharId): HTMLCanvasElement {
  const c = el('canvas', { width: '192', height: '200', class: 'kb-portrait' });
  const ctx = c.getContext('2d');
  if (ctx) {
    // Accent-coloured spotlight backdrop, then the fighter large and slightly cropped like a portrait.
    const g = ctx.createRadialGradient(96, 80, 10, 96, 100, 130);
    g.addColorStop(0, SKINS[id].accent); g.addColorStop(1, '#1b1b2a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 192, 200);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = -4; i < 10; i++) { ctx.beginPath(); ctx.moveTo(i * 30, 200); ctx.lineTo(i * 30 + 14, 200); ctx.lineTo(i * 30 + 74, 0); ctx.lineTo(i * 30 + 60, 0); ctx.fill(); }
    ctx.scale(2, 2); ctx.translate(48, 116); ctx.scale(0.8, 0.8);
    drawPuppet(ctx, SKINS[id], getPose('idle'), 0, 0, 1, { frame: 0 });
  }
  return c;
}
const bar = (name: string, v: number): HTMLElement =>
  el('div', { class: 'kb-stat' }, [el('span', {}, [name]), el('span', { class: 'kb-bar' }, [el('i', { style: `width:${v * 20}%` })]), el('em', {}, [`${v}/5`])]);

/** Spec §15 character select: P1 cursor blue, P2 red; vs CPU / training P1 picks both in turn. */
export function showCharSelect(root: HTMLElement, o: CharSelectOpts): () => void {
  const cur: [number, number] = [ROSTER.indexOf(o.initial[0]), ROSTER.indexOf(o.initial[1])];
  const locked = [false, false];
  let stage: StageId | null = null;
  const tiles = ROSTER.map((id, i) => {
    const t = el('button', { type: 'button', class: 'kb-tile', 'aria-label': CHARS[id].name }, [
      portrait(id), el('b', {}, [CHARS[id].name]), el('small', {}, [STATS[id].tag]),
      bar('Power', STATS[id].power), bar('Speed', STATS[id].speed), bar('Range', STATS[id].range)]);
    t.addEventListener('click', () => { const p = active(); if (p !== null) { cur[p] = i; lock(p); } });
    return t;
  });
  const stageRow = el('div', { class: 'kb-stages' });
  const status = el('p', { class: 'kb-hint' });
  const active = (): 0 | 1 | null => (!locked[0] ? 0 : !locked[1] ? 1 : null);
  const draw = (): void => {
    tiles.forEach((t, i) => {
      t.classList.toggle('kb-p1', cur[0] === i); t.classList.toggle('kb-p2', cur[1] === i && (o.twoHumans || locked[0]));
      t.classList.toggle('kb-locked', (locked[0] && cur[0] === i) || (locked[1] && cur[1] === i));
    });
    const shown = stage ?? HOME_STAGE[ROSTER[cur[0]]!];
    stageRow.replaceChildren(el('span', {}, ['Stage']), ...STAGES.map(st => {
      const b = button(st, () => { stage = st; draw(); }, { class: `kb-btn${st === shown ? ' kb-on' : ''}` });
      return b;
    }));
    const p = active();
    status.textContent = o.twoHumans ? 'P1 and P2: left/right to choose, LP to confirm, LK to cancel'
      : p === 0 ? 'Choose your fighter (LP / click)' : p === 1 ? 'Choose the opponent (LP / click, LK to go back)' : '';
  };
  const lock = (p: 0 | 1): void => {
    locked[p] = true; draw();
    if (locked[0] && locked[1]) o.done({ chars: [ROSTER[cur[0]]!, ROSTER[cur[1]]!], stage: stage ?? HOME_STAGE[ROSTER[cur[0]]!] });
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Escape') { e.preventDefault(); o.back(); return; }
    for (const k of [0, 1] as const) {
      const map = o.keys[k];
      const p: 0 | 1 | null = o.twoHumans ? k : k === 0 ? active() ?? 1 : null;
      if (p === null || !Object.values(map).includes(e.code)) continue;
      e.preventDefault();
      if (e.code === map.left && !locked[p]) cur[p] = (cur[p] + ROSTER.length - 1) % ROSTER.length;
      else if (e.code === map.right && !locked[p]) cur[p] = (cur[p] + 1) % ROSTER.length;
      else if (e.code === map.LP && !locked[p]) { lock(p); return; }
      else if (e.code === map.LK) {
        if (o.twoHumans) locked[p] = false;
        else if (locked[0]) locked[0] = false; // single human: step back to P1's pick
      }
      draw();
    }
  };
  draw();
  const panel = screen('Character Select', [el('div', { class: 'kb-tiles' }, tiles), stageRow, status, button('Back', o.back)], 'kb-wide');
  root.replaceChildren(panel);
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); panel.remove(); };
}
