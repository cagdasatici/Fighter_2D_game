import { DUMMY_BEHAVIOURS, type DummyBehaviour, type TrainingOptions } from '../app/Training.js';
import { arrowNav, button, el, screen } from './dom.js';

export type PauseChoice = 'resume' | 'restart' | 'select' | 'title';

/** Offline pause menu (online has no pause, spec §15). Training adds dummy and refill options. */
export function showPause(root: HTMLElement, training: TrainingOptions | null, pick: (c: PauseChoice) => void): () => void {
  const menu = el('div', { class: 'kb-menu' }, [
    button('Resume', () => pick('resume')), button(training ? 'Reset position' : 'Restart', () => pick('restart')),
    button('Character Select', () => pick('select')), button('Title', () => pick('title'))]);
  const kids: HTMLElement[] = [menu];
  if (training) {
    const sel = el('select', { 'aria-label': 'Dummy behaviour' });
    const names: Record<DummyBehaviour, string> = { stand: 'Stand', crouch: 'Crouch', block: 'Block all', jump: 'Jump' };
    for (const d of DUMMY_BEHAVIOURS) { const o = el('option', { value: d }, [names[d]]); o.selected = d === training.dummy; sel.append(o); }
    sel.addEventListener('change', () => { training.dummy = sel.value as DummyBehaviour; });
    const box = (name: string, get: () => boolean, set: (v: boolean) => void): HTMLElement => {
      const i = el('input', { type: 'checkbox' }); i.checked = get();
      i.addEventListener('change', () => set(i.checked));
      return el('label', { class: 'kb-row' }, [el('span', {}, [name]), i]);
    };
    kids.push(el('h3', {}, ['Training']), el('label', { class: 'kb-row' }, [el('span', {}, ['Dummy']), sel]),
      box('Infinite HP', () => training.infiniteHp, v => { training.infiniteHp = v; }),
      box('Infinite meter', () => training.infiniteMeter, v => { training.infiniteMeter = v; }));
  }
  const panel = screen('Paused', kids, 'kb-pause');
  root.replaceChildren(panel);
  menu.querySelector('button')?.focus();
  const stop = arrowNav(menu);
  return () => { stop(); panel.remove(); };
}
