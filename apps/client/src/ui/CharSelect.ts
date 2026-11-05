import { CHARS, type CharId, type StageId } from '@kb/shared';
import { SKINS } from '../render/Gallery.js';
import { drawTurntable, particle, ringDelta, ringSlots, ringTween, spotlight } from '../render/Turntable.js';
import { easySpecials } from './HowToPlay.js';
import { button, el, menuNav, screen } from './dom.js';
import { keyLabel, stageName } from './text.js';
import type { KeyMap } from './Settings.js';

export const ROSTER: readonly CharId[] = ['bolt', 'volt', 'chompa', 'kaze', 'bao'];
/** characters.md §7 (display only). */
export const STATS: Readonly<Record<CharId, { power: number; speed: number; range: number; tag: string }>> = {
  bolt: { power: 3, speed: 3, range: 3, tag: 'All-rounder' },
  volt: { power: 2, speed: 3, range: 5, tag: 'Zoner' },
  chompa: { power: 5, speed: 1, range: 2, tag: 'Grappler' },
  kaze: { power: 2, speed: 5, range: 2, tag: 'Rushdown' },
  bao: { power: 4, speed: 2, range: 3, tag: 'Counter-heavy' },
};
/** characters.md §8. */
export const HOME_STAGE: Readonly<Record<CharId, StageId>> = { bolt: 'rooftop', volt: 'rooftop', kaze: 'bamboo', bao: 'bamboo', chompa: 'volcano' };
export const STAGES: readonly StageId[] = ['rooftop', 'bamboo', 'volcano'];

export interface CharSelectResult { chars: [CharId, CharId]; stage: StageId }
export interface CharSelectOpts {
  twoHumans: boolean; keys: [KeyMap, KeyMap]; initial: [CharId, CharId];
  done: (r: CharSelectResult) => void; back: () => void;
}

const bar = (name: string, v: number): HTMLElement =>
  el('div', { class: 'kb-stat' }, [el('span', {}, [name]), el('span', { class: 'kb-bar' }, [el('i', { style: `width:${v * 20}%` })]), el('em', {}, [`${v}/5`])]);

/** Spec §15 character select: P1 cursor blue, P2 red; vs CPU / training P1 picks both in turn. */
export function showCharSelect(root: HTMLElement, o: CharSelectOpts): () => void {
  const cur: [number, number] = [ROSTER.indexOf(o.initial[0]), ROSTER.indexOf(o.initial[1])];
  const locked = [false, false];
  let stage: StageId | null = null;
  const tiles = ROSTER.map((id, i) => {
    const t = el('button', { type: 'button', class: 'kb-tile', 'aria-label': CHARS[id].name }, [
      el('b', {}, [CHARS[id].name]), el('small', {}, [STATS[id].tag])]);
    t.addEventListener('click', () => { const p = active(); if (p !== null) { cur[p] = i; lock(p); } });
    return t;
  });
  const stageRow = el('div', { class: 'kb-stages' });
  const info = el('div', { class: o.twoHumans ? 'kb-sel-info kb-sel-left' : 'kb-sel-info' });
  // ---- SEL carousel (presentation only): ring focus tweens towards each player's cursor. ----
  const W = 880, H = 360;
  const cv = el('canvas', { class: 'kb-sel-canvas', width: String(W * 2), height: String(H * 2), 'aria-hidden': 'true' });
  const cx = cv.getContext('2d');
  const ring = [0, 1].map(p => ({ from: cur[p]!, to: cur[p]!, f: 99, last: cur[p]! }));
  const pickedAt: [number | null, number | null] = [null, null];
  let t = 0, raf = 0;
  const follow = (p: 0 | 1): void => {
    const r = ring[p]!;
    if (cur[p] === r.last) return;
    const now = ringTween(r.from, r.to, r.f);
    r.from = now; r.to = r.to + ringDelta(r.last, cur[p], ROSTER.length); r.f = 0; r.last = cur[p];
  };
  const drawRing = (c: CanvasRenderingContext2D, p: 0 | 1, x: number, y: number, R: number, k: number): void => {
    const r = ring[p]!;
    const focus = ringTween(r.from, r.to, r.f);
    for (const sl of ringSlots(ROSTER.length, focus, R)) {
      const id = ROSTER[sl.i]!;
      const front = sl.i === cur[p] && sl.z > 0.95;
      c.globalAlpha = sl.alpha;
      if (front) drawTurntable(c, SKINS[id], x + sl.x, y, t, { scale: k, pickedAt: locked[p] ? pickedAt[p] : null });
      else drawTurntable(c, SKINS[id], x + sl.x, y - (1 - sl.z) * 26 * k, t, { scale: k * sl.scale, noPodium: true, yaw: sl.theta });
      c.globalAlpha = 1;
    }
  };
  const frame = (): void => {
    raf = requestAnimationFrame(frame);
    t++;
    for (const r of ring) r.f++;
    if (!cx) return;
    cx.setTransform(2, 0, 0, 2, 0, 0);
    cx.clearRect(0, 0, W, H);
    const fp: 0 | 1 = o.twoHumans ? 0 : active() ?? 1;
    const acc = SKINS[ROSTER[cur[fp]]!].accent;
    const mainX = o.twoHumans ? W * 0.36 : W / 2;
    const sp = spotlight(acc);
    if (sp) cx.drawImage(sp, mainX - 180, 0, 360, H);
    const dot = particle(acc);
    if (dot) for (let i = 0; i < 24; i++) { // ≤ 30 particles, deterministic drift
      const px = mainX - 200 + ((i * 97 + t * (0.3 + (i % 5) * 0.1)) % 400);
      const py = H - ((i * 53 + t * (0.6 + (i % 3) * 0.3)) % H);
      cx.globalAlpha = 0.25 + (i % 4) * 0.15; cx.drawImage(dot, px, py, 8 + (i % 3) * 4, 8 + (i % 3) * 4);
    }
    cx.globalAlpha = 1;
    drawRing(cx, fp, mainX, H - 60, o.twoHumans ? 190 : 260, 1.7);
    if (o.twoHumans) drawRing(cx, 1, W * 0.82, H - 70, 90, 1.05);
    else if (locked[0]) { // P1 badge: the locked pick, small, top-left
      drawTurntable(cx, SKINS[ROSTER[cur[0]]!], 70, 150, t, { scale: 0.9, pickedAt: pickedAt[0] });
      badge(cx, 70, 176, 'P1', '#4aa8ff');
    }
    badge(cx, mainX, H - 18, o.twoHumans || active() !== 1 ? 'P1' : 'CPU', fp === 0 ? '#4aa8ff' : '#e63946');
    if (o.twoHumans) badge(cx, W * 0.82, H - 30, 'P2', '#e63946');
  };
  const badge = (c: CanvasRenderingContext2D, x: number, y: number, txt: string, color: string): void => {
    c.font = '900 italic 16px system-ui, sans-serif'; c.textAlign = 'center';
    c.fillStyle = color; c.beginPath(); c.roundRect(x - 22, y - 13, 44, 22, 8); c.fill();
    c.strokeStyle = '#1b1b2a'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#fff'; c.fillText(txt, x, y + 4);
  };
  const showInfo = (): void => {
    const p: 0 | 1 = o.twoHumans ? 0 : active() ?? 1;
    const id = ROSTER[cur[p]]!;
    const extra = o.twoHumans ? [el('p', { class: 'kb-sel-p2' }, [`P2: ${CHARS[ROSTER[cur[1]]!].name}`])] : [];
    info.replaceChildren(el('b', {}, [CHARS[id].name]), el('small', {}, [STATS[id].tag]),
      bar('Power', STATS[id].power), bar('Speed', STATS[id].speed), bar('Range', STATS[id].range),
      el('ul', { class: 'kb-list' }, easySpecials(id).map(([k, n]) => el('li', {}, [el('span', { class: 'kb-notation' }, [k]), el('span', {}, [n])]))),
      ...extra);
  };
  // Swipe on the carousel rotates the active ring; a tap locks the focused fighter.
  let sx0: number | null = null;
  const onDown = (e: PointerEvent): void => { sx0 = e.clientX; };
  const onUp = (e: PointerEvent): void => {
    if (sx0 === null) return;
    const dx = e.clientX - sx0; sx0 = null;
    const p = active();
    if (p === null || (o.twoHumans && p !== 0 && !locked[0])) return;
    if (Math.abs(dx) > 30) { cur[p] = (cur[p] + (dx < 0 ? 1 : ROSTER.length - 1)) % ROSTER.length; draw(); }
    else lock(p);
  };
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointerup', onUp);
  const status = el('p', { class: 'kb-hint' });
  const active = (): 0 | 1 | null => (!locked[0] ? 0 : !locked[1] ? 1 : null);
  const draw = (): void => {
    follow(0); follow(1); showInfo();
    tiles.forEach((t, i) => {
      t.classList.toggle('kb-p1', cur[0] === i); t.classList.toggle('kb-p2', cur[1] === i && (o.twoHumans || locked[0]));
      t.classList.toggle('kb-locked', (locked[0] && cur[0] === i) || (locked[1] && cur[1] === i));
    });
    const shown = stage ?? HOME_STAGE[ROSTER[cur[0]]!];
    stageRow.replaceChildren(el('span', {}, ['Stage']), ...STAGES.map(st => {
      const b = button(stageName(st), () => { stage = st; draw(); }, { class: `kb-btn${st === shown ? ' kb-on' : ''}`, 'data-stage': st, 'aria-pressed': String(st === shown) });
      return b;
    }));
    const p = active();
    const k = (c: string): string => keyLabel(c);
    const k1 = o.keys[0], k2 = o.keys[1];
    status.textContent = o.twoHumans
      ? `P1: ${k(k1.left)}/${k(k1.right)} choose, ${k(k1.LP)} lock in, ${k(k1.LK)} undo · P2: ${k(k2.left)}/${k(k2.right)}, ${k(k2.LP)}, ${k(k2.LK)}`
      : p === 0 ? `Pick your fighter: ${k(k1.left)}/${k(k1.right)} then ${k(k1.LP)}, or tap a portrait.`
      : p === 1 ? `Now pick your opponent. ${k(k1.LK)} goes back to your pick.` : 'Get ready…';
  };
  const lock = (p: 0 | 1): void => {
    locked[p] = true; pickedAt[p] = t; draw();
    if (locked[0] && locked[1]) o.done({ chars: [ROSTER[cur[0]]!, ROSTER[cur[1]]!], stage: stage ?? HOME_STAGE[ROSTER[cur[0]]!] });
  };
  const onKey = (e: KeyboardEvent): void => {
    for (const k of [0, 1] as const) {
      const map = o.keys[k];
      const p: 0 | 1 | null = o.twoHumans ? k : k === 0 ? active() ?? 1 : null;
      if (p === null || !Object.values(map).includes(e.code)) continue;
      e.preventDefault();
      if (e.code === map.left && !locked[p]) cur[p] = (cur[p] + ROSTER.length - 1) % ROSTER.length;
      else if (e.code === map.right && !locked[p]) cur[p] = (cur[p] + 1) % ROSTER.length;
      else if (e.code === map.LP && !locked[p]) { lock(p); return; }
      else if (e.code === map.LK) {
        if (o.twoHumans) locked[p] = false;
        else if (locked[0]) locked[0] = false; // single human: step back to P1's pick
      }
      draw();
    }
  };
  draw();
  const panel = screen('Character Select', [el('div', { class: 'kb-sel' }, [cv, info]), el('div', { class: 'kb-tiles kb-sel-names' }, tiles), stageRow, status,
    el('div', { class: 'kb-actions' }, [button('Back', o.back)])], 'kb-wide');
  root.replaceChildren(panel);
  window.addEventListener('keydown', onKey);
  // Arrow keys stay with the fighter cursors (P2 uses them); Esc / gamepad B go back, gamepad A presses the focused tile.
  const stopNav = menuNav(panel, { back: o.back, keys: false });
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointerup', onUp); stopNav(); window.removeEventListener('keydown', onKey); panel.remove(); };
}
