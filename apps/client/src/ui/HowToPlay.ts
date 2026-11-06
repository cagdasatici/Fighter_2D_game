import { CHARS, getMove, type CharId, type MoveDef } from '@kb/shared';
import { SP_TABLE, type SpDir } from '../input/Macro.js';
import { button, el, focusFirst, menuNav, screen } from './dom.js';
import type { KeyMap } from './Settings.js';
import { keyLabel } from './text.js';

export const MOTION: Readonly<Record<MoveDef['input']['motion'], string>> = {
  none: '', qcf: '↓↘→', qcb: '↓↙←', dp: '→↓↘', dqcf: '↓↘→↓↘→', dd: '↓↓', spin: '360°', charge: '[←] →',
};
const DIR: Readonly<Record<number, string>> = { 6: '→', 3: '↘', 2: '↓', 4: '←' };
/** Notation for a move, e.g. "↓↘→ + HP" (characters.md notation). Shown in the HELP1 move lists (owner request overrides the decision 0014 dev-only note). */
export function notation(m: MoveDef, generic = false): string {
  const btn = generic && /^(LP|HP)$/.test(m.input.button) ? 'P' : generic && /^(LK|HK)$/.test(m.input.button) ? 'K' : m.input.button;
  const pre = m.input.motion === 'none' ? (m.input.dir !== null ? DIR[m.input.dir] ?? '' : '') : MOTION[m.input.motion];
  const air = m.input.stance === 'air' ? ' (air)' : '';
  return `${pre ? `${pre} + ` : ''}${btn}${air}`;
}

const SP_LABEL: Readonly<Record<SpDir, string>> = { neutral: 'SP', up: '↑ + SP', back: '← + SP', down: '↓ + SP' };
/** Move display name + motion notation, e.g. "Rivet Shot (↓↘→ + HP)". Pure. */
export function moveText(id: CharId, move: string): string {
  const m = getMove(id, move);
  return m ? `${m.name} (${notation(m)})` : move;
}
/** Plain display name of a move (no motion notation: players use SP + direction). */
export function moveName(id: CharId, move: string): string { return getMove(id, move)?.name ?? move; }
/** Touch easy-special list for one character (characters.md SP macros), e.g. ["SP", "Rivet Shot (↓↘→ + HP)"]. Pure. */
export function easySpecials(id: CharId): [string, string][] {
  const t = SP_TABLE[id];
  const rows: [string, string][] = [[SP_LABEL.neutral, moveName(id, t.neutral.move)], [SP_LABEL.up, moveName(id, t.up.move)]];
  rows.push(['SUPER', `${moveName(id, t.superMove)} (full meter)`]);
  return rows;
}

const list = (rows: [string, string][]): HTMLElement =>
  el('ul', { class: 'kb-list' }, rows.map(([a, b]) => el('li', {}, [el('span', { class: 'kb-notation' }, [a]), el('span', {}, [b])])));

/** How to Play (TXT): tabs for Basics, Keyboard, Gamepad, Touch and Moves. Esc / B / Back return to the title. */
export function showHowToPlay(root: HTMLElement, keys: [KeyMap, KeyMap], back: () => void): () => void {
  const k = keyLabel;
  const p1 = keys[0], p2 = keys[1];
  const pages: Record<string, () => HTMLElement[]> = {
    Basics: () => [list([
      ['Win', 'Take two rounds. Empty the health bar or lead when the timer hits 0.'],
      ['Block', 'Hold back. Hold down-back to block low attacks.'],
      ['Throw', 'Light Punch + Light Kick up close.'],
      ['Dash', 'Tap forward twice (or back twice to dodge back).'],
      ['Super', 'Fill all 4 meter segments, then press SUPER.'],
      ['Specials', 'Press SP. Hold ↑, ← or ↓ with SP for a different special. Pause → Move List lists them all. No motions needed.'],
    ])],
    Keyboard: () => [list([
      ['Move', `P1 ${k(p1.up)} ${k(p1.left)} ${k(p1.down)} ${k(p1.right)} · P2 ${k(p2.up)} ${k(p2.left)} ${k(p2.down)} ${k(p2.right)}`],
      ['Punch', `P1 ${k(p1.LP)} light, ${k(p1.HP)} heavy · P2 ${k(p2.LP)}, ${k(p2.HP)}`],
      ['Kick', `P1 ${k(p1.LK)} light, ${k(p1.HK)} heavy · P2 ${k(p2.LK)}, ${k(p2.HK)}`],
      ['Special', `P1 ${k(p1.SP)} (SP) · P2 ${k(p2.SP)}. Hold a direction with it for another special.`],
      ['Super', `P1 ${k(p1.SU)} · P2 ${k(p2.SU)} (full meter)`],
      ['Throw', 'Light Punch + Light Kick together'],
      ['Pause', 'Esc (offline only)'],
      ['Menus', '↑ ↓ to choose, Enter to select, Esc to go back'],
      ['Rebind', 'Settings → Controls'],
    ])],
    Gamepad: () => [list([
      ['Move', 'D-pad or left stick'],
      ['Punch', 'X / □ light, Y / △ heavy'],
      ['Kick', 'A / × light, B / ○ heavy'],
      ['Special', 'RB (SP). Hold a direction for another special.'],
      ['Super', 'RT (full meter)'],
      ['Pause', 'Start (offline only)'],
      ['Menus', 'D-pad to choose, A to select, B to go back'],
    ])],
    Touch: () => [list([
      ['Move', 'Drag anywhere on the left half: a stick appears under your thumb.'],
      ['Attack', 'LP HP LK HK buttons on the right.'],
      ['SP', 'Special: press SP, with the stick held for a different move. The label shows which.'],
      ['SUPER', 'Glows gold when the meter is full.'],
      ['Pause', 'II button at the top.'],
      ['Layout', 'Settings → Controls → Touch layout'],
    ]), el('div', { class: 'kb-howto' }, ROSTER_IDS.map(id => el('div', { class: 'kb-char-moves' }, [el('h3', {}, [CHARS[id].name]), list(easySpecials(id))])))],
    Moves: () => [el('div', { class: 'kb-howto' }, ROSTER_IDS.map(id => el('div', { class: 'kb-char-moves' }, [el('h3', {}, [CHARS[id].name]), list(easySpecials(id))])))],
  };
  const body = el('div', { class: 'kb-howto-body' });
  const tabs = el('div', { class: 'kb-tabs', role: 'tablist' });
  const open = (name: string): void => {
    for (const b of tabs.querySelectorAll('button')) { const on = b.textContent === name; b.classList.toggle('kb-on', on); b.setAttribute('aria-selected', String(on)); }
    body.replaceChildren(...(pages[name]?.() ?? []));
  };
  tabs.append(...Object.keys(pages).map(n => button(n, () => open(n), { role: 'tab' })));
  open('Basics');
  const panel = screen('How to Play', [tabs, body, el('div', { class: 'kb-actions' }, [button('Back', back)])], 'kb-wide');
  root.replaceChildren(panel);
  const stop = menuNav(panel, { back });
  focusFirst(tabs);
  return () => { stop(); panel.remove(); };
}
const ROSTER_IDS: readonly CharId[] = ['bolt', 'volt', 'chompa', 'kaze', 'bao'];
