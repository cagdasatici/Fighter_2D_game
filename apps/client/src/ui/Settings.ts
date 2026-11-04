import { CPU_DIFFICULTIES, DOWN, HK, HP, LEFT, LK, LP, RIGHT, UP, type CpuDifficulty } from '@kb/shared';
import { button, el, screen } from './dom.js';

export const ACTIONS = ['up', 'down', 'left', 'right', 'LP', 'HP', 'LK', 'HK'] as const;
export type Action = typeof ACTIONS[number];
export type KeyMap = Record<Action, string>;
export const ACTION_BITS: Readonly<Record<Action, number>> = { up: UP, down: DOWN, left: LEFT, right: RIGHT, LP, HP, LK, HK };
export const DEFAULT_KEYS: readonly [KeyMap, KeyMap] = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', LP: 'KeyU', HP: 'KeyI', LK: 'KeyJ', HK: 'KeyK' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', LP: 'Numpad4', HP: 'Numpad5', LK: 'Numpad1', HK: 'Numpad2' },
];
/** Keys reserved by the shell; never bindable. */
export const RESERVED_KEYS = ['Escape', 'F1', 'Tab', 'Enter'];

export interface Settings {
  effectsVolume: number; musicVolume: number; musicOn: boolean;
  difficulty: CpuDifficulty; debugBoxes: boolean; keys: [KeyMap, KeyMap];
}
const STORAGE_KEY = 'kb.settings.v1';
export function defaultSettings(): Settings {
  return { effectsVolume: 1, musicVolume: 0.25, musicOn: true, difficulty: 'normal', debugBoxes: false,
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
    debugBoxes: r.debugBoxes === true, keys: [map(0), map(1)],
  };
}
export function loadSettings(): Settings {
  try { return parseSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); } catch { return defaultSettings(); }
}
export function saveSettings(s: Settings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* private mode: settings stay in memory */ }
}
/** Bind `code` to `action` for player `p`; a key used elsewhere is swapped so no key drives two actions. */
export function rebind(s: Settings, p: 0 | 1, action: Action, code: string): void {
  if (RESERVED_KEYS.includes(code)) return;
  const old = s.keys[p][action];
  for (const q of [0, 1] as const) for (const a of ACTIONS) if (s.keys[q][a] === code) s.keys[q][a] = old;
  s.keys[p][action] = code;
}

const label = (code: string): string => code.replace(/^(Key|Digit|Arrow)/, '');

/** Settings screen. `apply` is called after every change (audio, keyboard); returns cleanup. */
export function showSettings(root: HTMLElement, s: Settings, apply: () => void, back: () => void, editLayout?: () => void): () => void {
  let capture: { p: 0 | 1; a: Action; btn: HTMLButtonElement } | null = null;
  const changed = (): void => { saveSettings(s); apply(); };
  const slider = (name: string, get: () => number, set: (v: number) => void): HTMLElement => {
    const input = el('input', { type: 'range', min: '0', max: '100', value: String(Math.round(get() * 100)), 'aria-label': name });
    input.addEventListener('input', () => { set(Number(input.value) / 100); changed(); });
    return el('label', { class: 'kb-row' }, [el('span', {}, [name]), input]);
  };
  const check = (name: string, get: () => boolean, set: (v: boolean) => void): HTMLElement => {
    const input = el('input', { type: 'checkbox' });
    input.checked = get();
    input.addEventListener('change', () => { set(input.checked); changed(); });
    return el('label', { class: 'kb-row' }, [el('span', {}, [name]), input]);
  };
  const diff = el('select', { 'aria-label': 'CPU difficulty' });
  for (const d of CPU_DIFFICULTIES) { const o = el('option', { value: d }, [d]); o.selected = d === s.difficulty; diff.append(o); }
  diff.addEventListener('change', () => { s.difficulty = diff.value as CpuDifficulty; changed(); });
  const keyTable = el('div', { class: 'kb-keys' });
  const drawKeys = (): void => {
    keyTable.replaceChildren(el('span', {}, ['']), el('b', {}, ['P1']), el('b', {}, ['P2']));
    for (const a of ACTIONS) {
      keyTable.append(el('span', {}, [a]));
      for (const p of [0, 1] as const) {
        const b = button(label(s.keys[p][a]), () => {
          if (capture) capture.btn.classList.remove('kb-wait');
          capture = { p, a, btn: b }; b.textContent = 'press a key…'; b.classList.add('kb-wait');
        });
        keyTable.append(b);
      }
    }
  };
  const onKey = (e: KeyboardEvent): void => {
    if (!capture) { if (e.code === 'Escape') { e.preventDefault(); back(); } return; }
    e.preventDefault(); e.stopPropagation();
    if (e.code !== 'Escape') { rebind(s, capture.p, capture.a, e.code); changed(); }
    capture = null; drawKeys();
  };
  drawKeys();
  const rows: HTMLElement[] = [
    slider('Effects volume', () => s.effectsVolume, v => { s.effectsVolume = v; }),
    slider('Music volume', () => s.musicVolume, v => { s.musicVolume = v; }),
    check('Music', () => s.musicOn, v => { s.musicOn = v; }),
    el('label', { class: 'kb-row' }, [el('span', {}, ['CPU difficulty']), diff]),
  ];
  if (import.meta.env.DEV) rows.push(check('Debug boxes (dev, F1)', () => s.debugBoxes, v => { s.debugBoxes = v; }));
  const reset = button('Reset keys', () => { s.keys = [{ ...DEFAULT_KEYS[0] }, { ...DEFAULT_KEYS[1] }]; changed(); drawKeys(); });
  const panel = screen('Settings', [...rows, el('h3', {}, ['Keys']), keyTable, el('div', { class: 'kb-actions' }, [reset, ...(editLayout ? [button('Touch layout', editLayout)] : []), button('Back', back)])]);
  root.replaceChildren(panel);
  window.addEventListener('keydown', onKey, true);
  return () => { window.removeEventListener('keydown', onKey, true); panel.remove(); };
}
