/** Tiny DOM helpers shared by the S11 screens. Text is always set via text nodes (no innerHTML). */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, kids: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
}
export function button(text: string, onClick: () => void, attrs: Record<string, string> = {}): HTMLButtonElement {
  const b = el('button', { type: 'button', class: 'kb-btn', ...attrs }, [text]);
  b.addEventListener('click', onClick);
  return b;
}
export function screen(title: string, kids: (Node | string)[], cls = ''): HTMLElement {
  return el('section', { class: `kb-screen ${cls}`.trim() }, [el('h2', {}, [title]), ...kids]);
}
/** Arrow-key focus movement through the buttons of a menu; returns cleanup. */
export function arrowNav(container: HTMLElement): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (e.code !== 'ArrowDown' && e.code !== 'ArrowUp' && e.code !== 'KeyW' && e.code !== 'KeyS') return;
    const items = [...container.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    if (items.length === 0) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const down = e.code === 'ArrowDown' || e.code === 'KeyS';
    items[(i + (down ? 1 : items.length - 1) + (i < 0 && down ? 0 : 0)) % items.length]?.focus();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
