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

const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled])';
/** Next focus index in a wrapping list (-1 = nothing focused yet: forward lands on 0, backward on the last). */
export function nextIndex(i: number, n: number, forward: boolean): number {
  if (n <= 0) return -1;
  if (i < 0) return forward ? 0 : n - 1;
  return (i + (forward ? 1 : n - 1)) % n;
}
function moveFocus(container: HTMLElement, forward: boolean): void {
  const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
  const i = items.indexOf(document.activeElement as HTMLElement);
  items[nextIndex(i, items.length, forward)]?.focus();
}

export interface NavOpts {
  /** Escape / gamepad B. Omit on screens with nowhere to go back to. */
  back?: () => void;
  /** Arrow keys + W/S move focus (off where those keys already drive the screen, e.g. character select). Default true. */
  keys?: boolean;
  /** Escape triggers `back` (default true). Off where the shell already owns Escape (the pause toggle). */
  escape?: boolean;
}
/**
 * TXT: one navigation model for every menu. Keyboard: ↑/↓ (W/S) move focus, Enter/Space press, Esc goes back.
 * Gamepad: d-pad/stick move focus, A presses, B goes back. Touch/mouse use the buttons directly. Returns cleanup.
 */
export function menuNav(container: HTMLElement, o: NavOpts = {}): () => void {
  const keys = o.keys ?? true;
  const onKey = (e: KeyboardEvent): void => {
    if (e.code === 'Escape' && o.back && o.escape !== false) { e.preventDefault(); e.stopPropagation(); o.back(); return; }
    if (!keys) return;
    if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'text') return;
    if (document.activeElement instanceof HTMLSelectElement) return;
    const down = e.code === 'ArrowDown' || e.code === 'KeyS', up = e.code === 'ArrowUp' || e.code === 'KeyW';
    if (!down && !up) return;
    e.preventDefault();
    moveFocus(container, down);
  };
  window.addEventListener('keydown', onKey);
  // Gamepad polling (edge-triggered); stops with the screen.
  // First poll only records what is already held, so a press that opened this screen does not also act on it.
  let held: { up: boolean; down: boolean; a: boolean; b: boolean } | null = null;
  let raf = 0;
  const poll = (): void => {
    raf = requestAnimationFrame(poll);
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads().filter((p): p is Gamepad => p !== null && p.connected) : [];
    const now = { up: false, down: false, a: false, b: false };
    for (const p of pads) {
      const y = p.axes[1] ?? 0;
      now.up ||= p.buttons[12]?.pressed === true || p.buttons[14]?.pressed === true || y < -0.6;
      now.down ||= p.buttons[13]?.pressed === true || p.buttons[15]?.pressed === true || y > 0.6;
      now.a ||= p.buttons[0]?.pressed === true;
      now.b ||= p.buttons[1]?.pressed === true;
    }
    if (held === null) { held = now; return; }
    if (now.up && !held.up) moveFocus(container, false);
    if (now.down && !held.down) moveFocus(container, true);
    if (now.a && !held.a && document.activeElement instanceof HTMLElement && container.contains(document.activeElement)) document.activeElement.click();
    const backPressed = now.b && !held.b;
    held = now;
    if (backPressed && o.back) o.back();
  };
  raf = requestAnimationFrame(poll);
  return () => { window.removeEventListener('keydown', onKey); cancelAnimationFrame(raf); };
}
/** Back-compat: arrow-key focus movement only. */
export function arrowNav(container: HTMLElement): () => void { return menuNav(container); }
/** Focus the first enabled control inside `container`. */
export function focusFirst(container: HTMLElement): void { container.querySelector<HTMLElement>(FOCUSABLE)?.focus(); }
