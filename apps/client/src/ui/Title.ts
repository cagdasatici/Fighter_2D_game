import { el, focusFirst, menuNav, screen } from './dom.js';
import { button } from './dom.js';

export type TitleChoice = 'online' | 'cpu' | 'local' | 'training' | 'settings' | 'howto';

/** Spec §15 title menu (order fixed by the spec). */
export function showTitle(root: HTMLElement, pick: (c: TitleChoice) => void): () => void {
  const menu = el('div', { class: 'kb-menu' }, [
    button('Play Online', () => pick('online')),
    button('Versus CPU', () => pick('cpu')),
    button('Local 2P', () => pick('local')),
    button('Training', () => pick('training')),
    button('Settings', () => pick('settings')),
    button('How to Play', () => pick('howto')),
  ]);
  const panel = screen('', [el('h1', { class: 'kb-logo' }, ['Knockout Bash']), menu,
    el('p', { class: 'kb-hint' }, ['↑ ↓ to choose · Enter to select · Gamepad: A select, B back'])], 'kb-title');
  root.replaceChildren(panel);
  focusFirst(menu);
  const stopNav = menuNav(menu);
  return () => { stopNav(); panel.remove(); };
}
