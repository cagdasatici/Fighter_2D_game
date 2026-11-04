import { arrowNav, button, el, screen } from './dom.js';

export type TitleChoice = 'online' | 'cpu' | 'local' | 'training' | 'settings' | 'howto';

/** Spec §15 title menu. Online play arrives with S13, so its button is disabled for now. */
export function showTitle(root: HTMLElement, pick: (c: TitleChoice) => void): () => void {
  const online = button('Play Online', () => pick('online'), { disabled: '', title: 'Online play arrives in a later update' });
  const menu = el('div', { class: 'kb-menu' }, [
    online,
    button('Versus CPU', () => pick('cpu')),
    button('Local 2P', () => pick('local')),
    button('Training', () => pick('training')),
    button('Settings', () => pick('settings')),
    button('How to Play', () => pick('howto')),
  ]);
  const panel = screen('', [el('h1', { class: 'kb-logo' }, ['Knockout Bash']), menu, el('p', { class: 'kb-hint' }, ['Online play: coming soon'])], 'kb-title');
  root.replaceChildren(panel);
  menu.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
  const stopNav = arrowNav(menu);
  return () => { stopNav(); panel.remove(); };
}
