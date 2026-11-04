import { button, el, menuNav, screen } from './dom.js';

/**
 * Touch button layout (spec §12.3, LayoutEdit pattern from battlegrounds, simplified): each button is stored as its
 * centre offset from the bottom-right corner in CSS px, so it survives rotation. Edits that leave the right half,
 * the viewport, or overlap another button are rejected; an unsafe stored layout falls back to the default.
 */
export type TouchButtonId = 'LP' | 'HP' | 'LK' | 'HK' | 'SP';
export const TOUCH_BUTTONS: readonly TouchButtonId[] = ['LP', 'HP', 'LK', 'HK', 'SP'];
export const BUTTON_PX: Readonly<Record<TouchButtonId, number>> = { LP: 72, HP: 72, LK: 72, HK: 72, SP: 64 };
/** Offsets: dx = px left of the right edge, dy = px above the bottom edge (button centres). */
export type TouchLayout = Record<TouchButtonId, { dx: number; dy: number }>;
export const DEFAULT_LAYOUT: TouchLayout = {
  LP: { dx: 140, dy: 140 }, HP: { dx: 56, dy: 140 }, LK: { dx: 140, dy: 56 }, HK: { dx: 56, dy: 56 }, SP: { dx: 98, dy: 220 },
};
const STORAGE_KEY = 'kb.touchLayout.v1';

export interface Circle { cx: number; cy: number; r: number }
export function circles(layout: TouchLayout, w: number, h: number): Record<TouchButtonId, Circle> {
  const out = {} as Record<TouchButtonId, Circle>;
  for (const id of TOUCH_BUTTONS) out[id] = { cx: w - layout[id].dx, cy: h - layout[id].dy, r: BUTTON_PX[id] / 2 };
  return out;
}

/** Problems with a layout at a viewport size; empty = safe. */
export function validateLayout(layout: TouchLayout, w: number, h: number): string[] {
  const c = circles(layout, w, h), issues: string[] = [];
  for (const id of TOUCH_BUTTONS) {
    const b = c[id];
    if (!Number.isFinite(b.cx) || !Number.isFinite(b.cy)) { issues.push(`${id}: invalid`); continue; }
    if (b.cx - b.r < 0 || b.cy - b.r < 0 || b.cx + b.r > w || b.cy + b.r > h) issues.push(`${id} can't go off the screen.`);
    if (b.cx < w / 2) issues.push(`${id} must stay on the right half (the left half is the stick).`);
  }
  for (let i = 0; i < TOUCH_BUTTONS.length; i++) for (let j = i + 1; j < TOUCH_BUTTONS.length; j++) {
    const a = c[TOUCH_BUTTONS[i]!], b = c[TOUCH_BUTTONS[j]!];
    if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.r + b.r) issues.push(`${TOUCH_BUTTONS[i]} and ${TOUCH_BUTTONS[j]} can't overlap.`);
  }
  return issues;
}

export function parseLayout(raw: unknown): TouchLayout | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const out = {} as TouchLayout;
  for (const id of TOUCH_BUTTONS) {
    const v = (raw as Record<string, unknown>)[id] as { dx?: unknown; dy?: unknown } | undefined;
    if (!v || typeof v.dx !== 'number' || typeof v.dy !== 'number' || !Number.isFinite(v.dx) || !Number.isFinite(v.dy)) return null;
    out[id] = { dx: v.dx, dy: v.dy };
  }
  return out;
}
export function loadLayout(): TouchLayout {
  try { return parseLayout(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')) ?? structuredClone(DEFAULT_LAYOUT); }
  catch { return structuredClone(DEFAULT_LAYOUT); }
}
export function saveLayout(layout: TouchLayout): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch { /* storage blocked: layout lasts for this page only */ }
}
/** Layout to use at this viewport: the stored one if safe, else the default. */
export function effectiveLayout(layout: TouchLayout, w: number, h: number): TouchLayout {
  return validateLayout(layout, w, h).length === 0 ? layout : DEFAULT_LAYOUT;
}

/** Drag-to-move editor. Saves on Done; returns cleanup that removes every listener. */
export function showLayoutEdit(root: HTMLElement, initial: TouchLayout, done: (layout: TouchLayout) => void): () => void {
  const layout = structuredClone(effectiveLayout(initial, window.innerWidth, window.innerHeight));
  const field = el('div', { class: 'kb-touch kb-touch-edit' });
  const status = el('p', { class: 'kb-row', role: 'status', 'aria-live': 'polite' }, ['Drag a button to move it.']);
  const nodes = new Map<TouchButtonId, HTMLElement>();
  const place = (): void => {
    const c = circles(layout, window.innerWidth, window.innerHeight);
    for (const [id, n] of nodes) { n.style.left = `${c[id].cx - c[id].r}px`; n.style.top = `${c[id].cy - c[id].r}px`; }
  };
  let drag: { id: TouchButtonId; pointer: number } | null = null;
  for (const id of TOUCH_BUTTONS) {
    const n = el('div', { class: `kb-tbtn kb-tbtn-${id}` }, [id]);
    n.style.width = n.style.height = `${BUTTON_PX[id]}px`;
    n.addEventListener('pointerdown', ev => { drag = { id, pointer: ev.pointerId }; n.setPointerCapture(ev.pointerId); ev.preventDefault(); });
    nodes.set(id, n); field.append(n);
  }
  const move = (ev: PointerEvent): void => {
    if (!drag || ev.pointerId !== drag.pointer) return;
    const next = structuredClone(layout);
    next[drag.id] = { dx: window.innerWidth - ev.clientX, dy: window.innerHeight - ev.clientY };
    const issues = validateLayout(next, window.innerWidth, window.innerHeight);
    if (issues.length === 0) { Object.assign(layout, next); place(); status.textContent = 'Drag a button to move it.'; }
    else status.textContent = issues[0] ?? '';
  };
  const up = (ev: PointerEvent): void => { if (drag && ev.pointerId === drag.pointer) drag = null; };
  const panel = screen('Touch layout', [status, el('div', { class: 'kb-actions' }, [
    button('Reset Layout', () => { Object.assign(layout, structuredClone(DEFAULT_LAYOUT)); place(); status.textContent = 'Layout reset.'; }),
    button('Save', () => { saveLayout(layout); done(layout); }),
  ])], 'kb-layout-panel');
  const stopNav = menuNav(panel, { back: () => { saveLayout(layout); done(layout); } });
  root.replaceChildren(panel);
  document.body.append(field);
  place();
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('resize', place);
  return () => {
    stopNav();
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    window.removeEventListener('resize', place);
    field.remove(); panel.remove();
  };
}
