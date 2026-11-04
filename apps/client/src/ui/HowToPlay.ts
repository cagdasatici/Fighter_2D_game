import { CHARS, getMove, type CharId, type MoveDef } from '@kb/shared';
import { SP_TABLE, type SpDir } from '../input/Macro.js';
import { button, el, focusFirst, menuNav, screen } from './dom.js';
import type { KeyMap } from './Settings.js';
import { keyLabel } from './text.js';

const MOTION: Readonly<Record<MoveDef['input']['motion'], string>> = {
  none: '', qcf: '↓↘→', qcb: '↓↙←', dp: '→↓↘', dqcf: '↓↘→↓↘→', dd: '↓↓', spin: '360°', charge: '[←] →',
};
const DIR: Readonly<Record<number, string>> = { 6: '→', 3: '↘', 2: '↓', 4: '←' };
/** Notation for a move, e.g. "↓↘→ + P" (characters.md notation). */
export function notation(m: MoveDef, generic = false): string {
  const btn = generic && /^(LP|HP)$/.test(m.input.button) ? 'P' : generic && /^(LK|HK)$/.test(m.input.button) ? 'K' : m.input.button;
  const pre = m.input.motion === 'none' ? (m.input.dir !== null ? DIR[m.input.dir] ?? '' : '') : MOTION[m.input.motion];
  const air = m.input.stance === 'air' ? ' (air)' : '';
  return `${pre ? `${pre} + ` : ''}${btn}${air}`;
}

const SP_LABEL: Readonly<Record<SpDir, string>> = { neutral: 'SP', up: '↑ + SP', back: '← + SP', down: '↓ + SP' };
/** Touch easy-special list for one character (characters.md SP macros), e.g. ["SP", "Rivet Shot"]. Pure. */
export function easySpecials(id: CharId): [string, string][] {
  const t = SP_TABLE[id];
  const name = (move: string): string => getMove(id, move)?.name ?? move;
  const rows: [string, string][] = (['neutral', 'up', 'back', 'down'] as const).map(d => [SP_LABEL[d], name(t[d].move)]);
  if (t.down.move !== t.downUncharged.move) rows[3] = [SP_LABEL.down, `${name(t.down.move)} (after holding ← ~1 s), else ${name(t.downUncharged.move)}`];
  rows.push(['SP SP (full meter)', name(t.superMove)]);
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
      ['Super', 'Fill all 4 meter segments, then use the super motion.'],
      ['Notation', '↓↘→ means roll down to forward. P = any punch, K = any kick. [←] = hold back about 1 s.'],
    ])],
    Keyboard: () => [list([
      ['Move', `P1 ${k(p1.up)} ${k(p1.left)} ${k(p1.down)} ${k(p1.right)} · P2 ${k(p2.up)} ${k(p2.left)} ${k(p2.down)} ${k(p2.right)}`],
      ['Punch', `P1 ${k(p1.LP)} light, ${k(p1.HP)} heavy · P2 ${k(p2.LP)}, ${k(p2.HP)}`],
      ['Kick', `P1 ${k(p1.LK)} light, ${k(p1.HK)} heavy · P2 ${k(p2.LK)}, ${k(p2.HK)}`],
      ['Pause', 'Esc (offline only)'],
      ['Menus', '↑ ↓ to choose, Enter to select, Esc to go back'],
      ['Rebind', 'Settings → Controls'],
    ])],
    Gamepad: () => [list([
      ['Move', 'D-pad or left stick'],
      ['Punch', 'X / □ light, Y / △ heavy'],
      ['Kick', 'A / × light, B / ○ heavy'],
      ['Pause', 'Start (offline only)'],
      ['Menus', 'D-pad to choose, A to select, B to go back'],
    ])],
    Touch: () => [list([
      ['Move', 'Drag anywhere on the left half: a stick appears under your thumb.'],
      ['Attack', 'LP HP LK HK buttons on the right.'],
      ['SP', 'Easy special: press SP, with the stick held for a different move.'],
      ['Pause', 'II button at the top.'],
      ['Layout', 'Settings → Controls → Touch layout'],
    ]), el('div', { class: 'kb-howto' }, ROSTER_IDS.map(id => el('div', { class: 'kb-char-moves' }, [el('h3', {}, [CHARS[id].name]), list(easySpecials(id))])))],
    Moves: () => [el('div', { class: 'kb-howto' }, ROSTER_IDS.map(id => {
      const c = CHARS[id];
      const listed = c.moves.filter(m => m.kind !== 'normal' && m.kind !== 'throw');
      // LP/HP (or LK/HK) strength variants share a name: list once with a generic P / K button.
      const rows = listed.filter((m, i) => listed.findIndex(x => x.name === m.name) === i).map(m =>
        el('li', {}, [el('span', { class: 'kb-move' }, [m.name]),
          el('span', { class: 'kb-notation' }, [notation(m, listed.filter(x => x.name === m.name).length > 1)])]));
      return el('div', { class: 'kb-char-moves' }, [el('h3', {}, [c.name]), el('ul', {}, rows)]);
    }))],
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
