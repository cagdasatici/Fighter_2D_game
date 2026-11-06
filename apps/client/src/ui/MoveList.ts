import { CHARS, type CharId } from '@kb/shared';
import { SP_TABLE } from '../input/Macro.js';
import { button, el, focusFirst, menuNav, screen } from './dom.js';
import { easySpecials, moveName } from './HowToPlay.js';
import type { KeyMap } from './Settings.js';
import { keyLabel } from './text.js';

/** Bound control labels for one player. Pad 1 drives P1 and pad 2 drives P2; touch exists only for P1. */
export interface ControlLabels { sp: string; su: string; lp: string; lk: string; pad: boolean; touch: boolean }
export function controlLabels(keys: KeyMap, p: 0 | 1): ControlLabels {
  return { sp: keyLabel(keys.SP), su: keyLabel(keys.SU), lp: keyLabel(keys.LP), lk: keyLabel(keys.LK), pad: true, touch: p === 0 };
}
export const via = (key: string, pad: string | null, touch: string | null): string =>
  [key, pad ? `pad ${pad}` : '', touch ? `touch ${touch}` : ''].filter(Boolean).join(' / ');

/** "key / pad RT / touch SUPER" label for the super button of one player. */
export const superLabel = (c: ControlLabels): string => via(c.su, c.pad ? 'RT' : null, c.touch ? 'SUPER' : null);

/** Move List rows [left, right] for one character: specials with their SP shortcut, throw, super. Pure (unit-tested). */
export function moveListRows(id: CharId, c: ControlLabels): [string, string][] {
  const sp = via(c.sp, c.pad ? 'RB' : null, c.touch ? 'SP' : null), su = superLabel(c);
  const rows: [string, string][] = easySpecials(id).slice(0, -1).map(([shortcut, text]) => [text, shortcut.replace('SP', `SP [${sp}]`)]);
  rows.push(['Throw', `LP + LK (${c.lp} + ${c.lk}) up close. If grabbed, press LP + LK to tech it.`]);
  rows.push([`Super: ${moveName(id, SP_TABLE[id].superMove)}`, `Full meter: press SUPER [${su}]`]);
  return rows;
}

/** Pause → Move List: one panel per human player (character and bound keys). Back / Esc / B return to the pause menu. */
export function showMoveList(root: HTMLElement, players: { label: string; char: CharId; keys: KeyMap; p: 0 | 1 }[], back: () => void): () => void {
  const body = el('div', { class: 'kb-howto' }, players.map(pl => el('div', { class: 'kb-char-moves' }, [
    el('h3', {}, [`${pl.label}: ${CHARS[pl.char].name}`]),
    el('ul', { class: 'kb-list' }, moveListRows(pl.char, controlLabels(pl.keys, pl.p)).map(([a, b]) => el('li', {}, [el('span', { class: 'kb-notation' }, [a]), el('span', {}, [b])]))),
  ])));
  const panel = screen('Move List', [body, el('div', { class: 'kb-actions' }, [button('Back', back)])], 'kb-wide');
  root.replaceChildren(panel);
  const stop = menuNav(panel, { back });
  focusFirst(panel);
  return () => { stop(); panel.remove(); };
}
