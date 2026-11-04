import { CHARS, type CharId, type MoveDef } from '@kb/shared';
import { button, el, screen } from './dom.js';
import type { KeyMap } from './Settings.js';

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

export function showHowToPlay(root: HTMLElement, keys: KeyMap, back: () => void): () => void {
  const k = (c: string): string => c.replace(/^(Key|Digit|Arrow)/, '');
  const basics = el('p', {}, [`Move ${k(keys.up)} ${k(keys.left)} ${k(keys.down)} ${k(keys.right)} · LP ${k(keys.LP)} · HP ${k(keys.HP)} · LK ${k(keys.LK)} · HK ${k(keys.HK)} · `
    + 'hold back to block (down-back for lows) · LP+LK close = throw · Esc pauses offline. P = any punch, K = any kick.']);
  const chars = (Object.keys(CHARS) as CharId[]).map(id => {
    const c = CHARS[id];
    const listed = c.moves.filter(m => m.kind !== 'normal' && m.kind !== 'throw');
    // LP/HP (or LK/HK) strength variants share a name: list once with a generic P / K button.
    const rows = listed.filter((m, i) => listed.findIndex(x => x.name === m.name) === i).map(m =>
      el('li', {}, [el('span', { class: 'kb-move' }, [m.name]),
        el('span', { class: 'kb-notation' }, [notation(m, listed.filter(x => x.name === m.name).length > 1)])]));
    return el('div', { class: 'kb-char-moves' }, [el('h3', {}, [c.name]), el('ul', {}, rows)]);
  });
  const panel = screen('How to Play', [basics, el('div', { class: 'kb-howto' }, chars), button('Back', back)], 'kb-wide');
  root.replaceChildren(panel);
  const onKey = (e: KeyboardEvent): void => { if (e.code === 'Escape') { e.preventDefault(); back(); } };
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener('keydown', onKey); panel.remove(); };
}
