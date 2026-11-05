import { CPU_DIFFICULTIES, DOWN, HK, HP, LEFT, LK, LP, RIGHT, UP, type CpuDifficulty } from '@kb/shared';
import { button, el, focusFirst, menuNav, screen } from './dom.js';
import { ACTION_NAMES, DIFFICULTY_INFO, keyLabel } from './text.js';

export const ACTIONS = ['up', 'down', 'left', 'right', 'LP', 'HP', 'LK', 'HK', 'SP', 'SU'] as const;
export type Action = typeof ACTIONS[number];
export type KeyMap = Record<Action, string>;
export const ACTION_BITS: Readonly<Record<Action, number>> = { up: UP, down: DOWN, left: LEFT, right: RIGHT, LP, HP, LK, HK, SP: 0, SU: 0 };
export const DEFAULT_KEYS: readonly [KeyMap, KeyMap] = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', LP: 'KeyU', HP: 'KeyI', LK: 'KeyJ', HK: 'KeyK', SP: 'KeyL', SU: 'KeyO' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', LP: 'Numpad4', HP: 'Numpad5', LK: 'Numpad1', HK: 'Numpad2', SP: 'Numpad6', SU: 'Numpad3' },
];
/** Keys reserved by the shell; never bindable. */
export const RESERVED_KEYS = ['Escape', 'F1', 'Tab', 'Enter'];

export interface Settings {
  effectsVolume: number; musicVolume: number; musicOn: boolean;
  difficulty: CpuDifficulty; debugBoxes: boolean; screenShake: boolean; reducedFx: boolean; keys: [KeyMap, KeyMap];
}
const STORAGE_KEY = 'kb.settings.v1';
export function defaultSettings(): Settings {
  return { effectsVolume: 1, musicVolume: 0.25, musicOn: true, difficulty: 'normal', debugBoxes: false, screenShake: true, reducedFx: false,
    keys: [{ ...DEFAULT_KEYS[0] }, { ...DEFAULT_KEYS[1] }] };
}

const unit = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);
/** Validates untrusted stored JSON field by field; anything malformed falls back to defaults. */
export function parseSettings(raw: unknown): Settings {
  const d = defaultSettings();
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as Record<string, unknown>;
  const keys = Array.isArray(r.keys) ? r.keys : [];
  const map = (i: 0 | 1): KeyMap => {
    const src = (typeof keys[i] === 'object' && keys[i] !== null ? keys[i] : {}) as Record<string, unknown>;
    const out = { ...d.keys[i] };
    for (const a of ACTIONS) { const v = src[a]; if (typeof v === 'string' && v.length > 0 && v.length < 32 && !RESERVED_KEYS.includes(v)) out[a] = v; }
    return out;
  };
  return {
    effectsVolume: unit(r.effectsVolume, d.effectsVolume), musicVolume: unit(r.musicVolume, d.musicVolume),
    musicOn: typeof r.musicOn === 'boolean' ? r.musicOn : d.musicOn,
    difficulty: CPU_DIFFICULTIES.includes(r.difficulty as CpuDifficulty) ? (r.difficulty as CpuDifficulty) : d.difficulty,
    debugBoxes: r.debugBoxes === true, screenShake: typeof r.screenShake === 'boolean' ? r.screenShake : d.screenShake, reducedFx: r.reducedFx === true, keys: [map(0), map(1)],
  };
}
export function loadSettings(): Settings {
  try { return parseSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); } catch { return defaultSettings(); }
}
export function saveSettings(s: Settings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* private mode: settings stay in memory */ }
}
/** Result of a rebind: whether it happened and which other binding (if any) was swapped onto the old key. */
export interface RebindResult { ok: boolean; reserved: boolean; swapped: { p: 0 | 1; action: Action } | null }
/** Bind `code` to `action` for player `p`; a key used elsewhere is swapped so no key drives two actions. */
export function rebind(s: Settings, p: 0 | 1, action: Action, code: string): RebindResult {
  if (RESERVED_KEYS.includes(code)) return { ok: false, reserved: true, swapped: null };
  const old = s.keys[p][action];
  let swapped: RebindResult['swapped'] = null;
  for (const q of [0, 1] as const) for (const a of ACTIONS) {
    if (s.keys[q][a] === code && !(q === p && a === action)) { s.keys[q][a] = old; swapped = { p: q, action: a }; }
  }
  s.keys[p][action] = code;
  return { ok: true, reserved: false, swapped };
}
/** TXT: restore every setting to its default in place (callers hold the same object). */
export function resetSettings(s: Settings): void { Object.assign(s, defaultSettings()); }
/** Rebind feedback line shown under the key table. */
export function rebindMessage(r: RebindResult, p: 0 | 1, action: Action, code: string, oldCode: string): string {
  if (r.reserved) return `${keyLabel(code)} is reserved. Pick another key.`;
  const what = `P${p + 1} ${ACTION_NAMES[action]}`;
  if (r.swapped) return `${what} is now ${keyLabel(code)}. It was used by P${r.swapped.p + 1} ${ACTION_NAMES[r.swapped.action]}, which moved to ${keyLabel(oldCode)}.`;
  return `${what} is now ${keyLabel(code)}.`;
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** Settings screen (TXT: Audio · Gameplay · Controls · Display). `apply` runs after every change; returns cleanup. */
export function showSettings(root: HTMLElement, s: Settings, apply: () => void, back: () => void, editLayout?: () => void): () => void {
  let capture: { p: 0 | 1; a: Action; btn: HTMLButtonElement } | null = null;
  const changed = (): void => { saveSettings(s); apply(); };
  const keyStatus = el('p', { class: 'kb-hint kb-left', role: 'status', 'aria-live': 'polite' }, ['Click a key to change it.']);
  const slider = (name: string, get: () => number, set: (v: number) => void): HTMLElement => {
    const out = el('output', {}, [pct(get())]);
    const input = el('input', { type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(get() * 100)), 'aria-label': name });
    input.addEventListener('input', () => { set(Number(input.value) / 100); out.textContent = pct(get()); changed(); });
    return el('label', { class: 'kb-row' }, [el('span', {}, [name]), el('span', { class: 'kb-val' }, [input, out])]);
  };
  const check = (name: string, get: () => boolean, set: (v: boolean) => void): HTMLElement => {
    const input = el('input', { type: 'checkbox' });
    input.checked = get();
    const out = el('output', {}, [get() ? 'On' : 'Off']);
    input.addEventListener('change', () => { set(input.checked); out.textContent = input.checked ? 'On' : 'Off'; changed(); });
    return el('label', { class: 'kb-row' }, [el('span', {}, [name]), el('span', { class: 'kb-val' }, [input, out])]);
  };
  const diffNote = el('p', { class: 'kb-hint kb-left' });
  const diff = el('select', { 'aria-label': 'CPU difficulty' });
  for (const d of CPU_DIFFICULTIES) { const o = el('option', { value: d }, [DIFFICULTY_INFO[d].name]); o.selected = d === s.difficulty; diff.append(o); }
  const syncDiff = (): void => { diffNote.textContent = DIFFICULTY_INFO[s.difficulty].blurb; };
  diff.addEventListener('change', () => { s.difficulty = diff.value as CpuDifficulty; syncDiff(); changed(); });
  syncDiff();
  const keyTable = el('div', { class: 'kb-keys' });
  const drawKeys = (): void => {
    keyTable.replaceChildren(el('span', {}, ['']), el('b', {}, ['Player 1']), el('b', {}, ['Player 2']));
    for (const a of ACTIONS) {
      keyTable.append(el('span', {}, [ACTION_NAMES[a]]));
      for (const p of [0, 1] as const) {
        const b = button(keyLabel(s.keys[p][a]), () => {
          if (capture) { capture.btn.classList.remove('kb-wait'); capture.btn.textContent = keyLabel(s.keys[capture.p][capture.a]); }
          capture = { p, a, btn: b }; b.textContent = 'Press a key…'; b.classList.add('kb-wait');
          keyStatus.textContent = `Press a key for P${p + 1} ${ACTION_NAMES[a]}. Esc cancels.`;
        }, { 'aria-label': `P${p + 1} ${ACTION_NAMES[a]}: ${keyLabel(s.keys[p][a])}` });
        keyTable.append(b);
      }
    }
  };
  const onKey = (e: KeyboardEvent): void => {
    if (!capture) return;
    e.preventDefault(); e.stopPropagation();
    const { p, a, btn } = capture;
    if (e.code === 'Escape') keyStatus.textContent = 'Cancelled. Click a key to change it.';
    else {
      const oldCode = s.keys[p][a];
      const r = rebind(s, p, a, e.code);
      keyStatus.textContent = rebindMessage(r, p, a, e.code, oldCode);
      if (r.ok) changed();
    }
    capture = null; drawKeys();
    keyTable.querySelector<HTMLButtonElement>(`[aria-label^="${btn.getAttribute('aria-label')?.split(':')[0] ?? ''}:"]`)?.focus();
  };
  drawKeys();
  const rebuild = (): void => { cleanup(); cleanup = showSettings(root, s, apply, back, editLayout); };
  const audio = [
    slider('Effects volume', () => s.effectsVolume, v => { s.effectsVolume = v; }),
    check('Music', () => s.musicOn, v => { s.musicOn = v; }),
    slider('Music volume', () => s.musicVolume, v => { s.musicVolume = v; }),
  ];
  const display = [
    check('Screen shake', () => s.screenShake, v => { s.screenShake = v; }),
    check('Reduced effects', () => s.reducedFx, v => { s.reducedFx = v; }),
  ];
  const gameplay = [el('label', { class: 'kb-row' }, [el('span', {}, ['CPU difficulty']), diff]), diffNote];
  const controls = [keyTable, keyStatus, el('div', { class: 'kb-actions' }, [
    button('Reset keys', () => { s.keys = [{ ...DEFAULT_KEYS[0] }, { ...DEFAULT_KEYS[1] }]; changed(); drawKeys(); keyStatus.textContent = 'Keys reset to defaults.'; }),
    ...(editLayout ? [button('Touch layout', editLayout)] : [])])];
  const sections: HTMLElement[] = [
    el('fieldset', { class: 'kb-section' }, [el('legend', {}, ['Audio']), ...audio]),
    el('fieldset', { class: 'kb-section' }, [el('legend', {}, ['Gameplay']), ...gameplay]),
    el('fieldset', { class: 'kb-section' }, [el('legend', {}, ['Effects']), ...display]),
    el('fieldset', { class: 'kb-section' }, [el('legend', {}, ['Controls']), ...controls]),
  ];
  if (import.meta.env.DEV) sections.push(el('fieldset', { class: 'kb-section' }, [el('legend', {}, ['Display (dev build)']),
    check('Hitboxes (F1)', () => s.debugBoxes, v => { s.debugBoxes = v; })]));
  const panel = screen('Settings', [...sections, el('div', { class: 'kb-actions' }, [
    button('Reset to defaults', () => { resetSettings(s); changed(); rebuild(); }),
    button('Back', back)]), el('p', { class: 'kb-hint' }, ['Changes save automatically.'])], 'kb-wide kb-settings');
  root.replaceChildren(panel);
  // Capture-phase so a key being rebound never reaches the game or the menu navigation.
  window.addEventListener('keydown', onKey, true);
  const stopNav = menuNav(panel, { back: () => { if (!capture) back(); } });
  focusFirst(panel);
  let cleanup = (): void => { stopNav(); window.removeEventListener('keydown', onKey, true); panel.remove(); };
  return () => cleanup();
}
