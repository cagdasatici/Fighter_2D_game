import { DOWN, HK, HP, LEFT, LK, LP, RIGHT, UP, cleanSocd, type InputByte } from '@kb/shared';
import { BUTTON_PX, TOUCH_BUTTONS, circles, effectiveLayout, type TouchButtonId, type TouchLayout } from '../ui/LayoutEdit.js';
import { spDirection, macroEntry, type SpContext } from './Macro.js';

export const STICK_RADIUS = 60;
export const STICK_DEADZONE = 14;
const BITS: Readonly<Record<Exclude<TouchButtonId, 'SP' | 'SU'>, number>> = { LP, HP, LK, HK };
// 8 sectors of 45°, starting at "right" and going counter-clockwise (screen y grows downward).
const SECTORS = [RIGHT, RIGHT | UP, UP, LEFT | UP, LEFT, LEFT | DOWN, DOWN, RIGHT | DOWN];

/** Floating-stick vector (css px, +y down) → direction bits. Deadzone 14 px, 45° sectors (spec §12.3). */
export function stickBits(dx: number, dy: number): InputByte {
  if (Math.hypot(dx, dy) < STICK_DEADZONE) return 0;
  const a = Math.atan2(-dy, dx); // radians, counter-clockwise from right
  const i = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  return SECTORS[i] ?? 0;
}

/**
 * iPad touch controls (spec §12.3): left half floating stick, right side LP/HP/LK/HK + SP easy-special.
 * Each pointerId is tracked separately. Shown only while `setActive(true)` (fight scene). Player 1 only.
 */
export class Touch {
  private readonly root: HTMLElement;
  private readonly stickBase: HTMLElement;
  private readonly stickKnob: HTMLElement;
  private readonly nodes = new Map<TouchButtonId, HTMLElement>();
  private readonly pointers = new Map<number, { kind: 'stick'; ox: number; oy: number; x: number; y: number } | { kind: 'button'; id: TouchButtonId }>();
  private spLatched = false;
  private suLatched = false;
  private active = false;
  private used = false;
  private layout: TouchLayout;
  constructor(layout: TouchLayout, private readonly context: () => SpContext | null, private readonly labelOf: (ctx: SpContext, move: string) => string, private readonly onPause: () => void) {
    this.layout = layout;
    this.root = document.createElement('div');
    this.root.className = 'kb-touch';
    this.root.hidden = true;
    this.stickBase = document.createElement('div'); this.stickBase.className = 'kb-stick'; this.stickBase.hidden = true;
    this.stickKnob = document.createElement('div'); this.stickKnob.className = 'kb-knob';
    this.stickBase.append(this.stickKnob);
    this.root.append(this.stickBase);
    for (const id of TOUCH_BUTTONS) {
      const n = document.createElement('div');
      n.className = `kb-tbtn kb-tbtn-${id}`; n.textContent = id === 'SU' ? 'SUPER' : id;
      n.style.width = n.style.height = `${BUTTON_PX[id]}px`;
      this.nodes.set(id, n); this.root.append(n);
    }
    const pause = document.createElement('button');
    pause.type = 'button'; pause.className = 'kb-tpause'; pause.textContent = 'II'; pause.setAttribute('aria-label', 'Pause');
    pause.addEventListener('click', this.pause);
    this.root.append(pause);
    document.body.append(this.root);
    this.root.addEventListener('pointerdown', this.down);
    this.root.addEventListener('pointermove', this.move);
    this.root.addEventListener('pointerup', this.up);
    this.root.addEventListener('pointercancel', this.up);
    this.root.addEventListener('lostpointercapture', this.up);
    window.addEventListener('pointerdown', this.detect, true);
    window.addEventListener('resize', this.place);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.clear);
    this.place();
  }
  /** Touch UI appears once a touch is seen (or on coarse-pointer devices) and only in the fight scene. */
  setActive(on: boolean): void {
    this.active = on;
    this.root.hidden = !(on && (this.used || matchMedia('(pointer: coarse)').matches));
    if (!on) this.clear();
  }
  setLayout(layout: TouchLayout): void { this.layout = layout; this.place(); }
  private pause = (): void => { this.onPause(); };
  private detect = (e: PointerEvent): void => { if (e.pointerType === 'touch' && !this.used) { this.used = true; this.setActive(this.active); } };
  private place = (): void => {
    const w = window.innerWidth, h = window.innerHeight;
    const c = circles(effectiveLayout(this.layout, w, h), w, h);
    for (const [id, n] of this.nodes) { n.style.left = `${c[id].cx - c[id].r}px`; n.style.top = `${c[id].cy - c[id].r}px`; }
  };
  private hit(x: number, y: number): TouchButtonId | null {
    const w = window.innerWidth, h = window.innerHeight;
    const c = circles(effectiveLayout(this.layout, w, h), w, h);
    let best: TouchButtonId | null = null, bestD = Infinity;
    for (const id of TOUCH_BUTTONS) {
      const d = Math.hypot(x - c[id].cx, y - c[id].cy);
      if (d <= c[id].r + 8 && d < bestD) { best = id; bestD = d; }
    }
    return best;
  }
  private down = (e: PointerEvent): void => {
    if ((e.target as HTMLElement).classList.contains('kb-tpause')) return;
    e.preventDefault();
    const id = this.hit(e.clientX, e.clientY);
    if (id) {
      this.pointers.set(e.pointerId, { kind: 'button', id });
      if (id === 'SP') this.spLatched = true;
      if (id === 'SU') this.suLatched = true;
      this.nodes.get(id)?.classList.add('kb-down');
    } else if (e.clientX < window.innerWidth / 2 && ![...this.pointers.values()].some(p => p.kind === 'stick')) {
      this.pointers.set(e.pointerId, { kind: 'stick', ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY });
      this.stickBase.hidden = false;
      this.stickBase.style.left = `${e.clientX - STICK_RADIUS}px`; this.stickBase.style.top = `${e.clientY - STICK_RADIUS}px`;
      this.stickKnob.style.transform = 'translate(0px, 0px)';
    } else return;
    try { this.root.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
  };
  private move = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p || p.kind !== 'stick') return;
    e.preventDefault();
    p.x = e.clientX; p.y = e.clientY;
    let dx = p.x - p.ox, dy = p.y - p.oy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) { dx = dx / len * STICK_RADIUS; dy = dy / len * STICK_RADIUS; }
    this.stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  private up = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.kind === 'stick') this.stickBase.hidden = true;
    else if (![...this.pointers.values()].some(q => q.kind === 'button' && q.id === p.id)) this.nodes.get(p.id)?.classList.remove('kb-down');
  };
  private clear = (): void => {
    this.pointers.clear(); this.spLatched = false; this.suLatched = false;
    this.stickBase.hidden = true;
    for (const n of this.nodes.values()) n.classList.remove('kb-down');
  };
  private live(): InputByte {
    let b = 0;
    for (const p of this.pointers.values()) {
      if (p.kind === 'stick') b |= stickBits(p.x - p.ox, p.y - p.oy);
      else if (p.id !== 'SP' && p.id !== 'SU') b |= BITS[p.id];
    }
    return cleanSocd(b);
  }
  /** Player-1 stick/button bits (SP/SU excluded) for this frame. */
  read(): InputByte { return this.active ? this.live() : 0; }
  /** SP/SU press edges since the last call. */
  takeEdges(): { sp: boolean; su: boolean } {
    const e = { sp: this.active && this.spLatched, su: this.active && this.suLatched };
    this.spLatched = false; this.suLatched = false;
    return e;
  }
  /** Refresh the SP move label and the SUPER glow (call each rendered frame). */
  refresh(): void {
    const ctx = this.context();
    const sp = this.nodes.get('SP'), su = this.nodes.get('SU');
    if (su) { su.classList.toggle('kb-ready', !!ctx?.meterFull); su.classList.toggle('kb-off', !ctx?.meterFull); }
    if (sp && ctx) {
      const dir = spDirection(this.live(), ctx.facing);
      const text = this.labelOf(ctx, macroEntry(ctx.char, dir, ctx.charged).move);
      if (sp.dataset.label !== text) { sp.dataset.label = text; sp.title = text; }
    }
  }
  dispose(): void {
    this.root.removeEventListener('pointerdown', this.down);
    this.root.removeEventListener('pointermove', this.move);
    this.root.removeEventListener('pointerup', this.up);
    this.root.removeEventListener('pointercancel', this.up);
    this.root.removeEventListener('lostpointercapture', this.up);
    window.removeEventListener('pointerdown', this.detect, true);
    window.removeEventListener('resize', this.place);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('visibilitychange', this.clear);
    this.clear();
    this.root.remove();
  }
}
