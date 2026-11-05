import { CHARS, METER_MAX, ROUNDS_TO_WIN, type CharId, type MatchState } from '@kb/shared';
import { SKINS } from './Gallery.js';
import { cacheLayer, getLayer } from './Layers.js';

/** Spec §9.6 HUD. Pure helpers are exported for unit tests. */
export function timerDigits(framesLeft: number): string {
  const s = Math.max(0, Math.min(99, Math.ceil(framesLeft / 60)));
  return String(s).padStart(2, '0');
}
export function comboText(hits: number): string { return hits >= 2 ? `${hits} HITS` : ''; }
export function roundText(phase: MatchState['phase'], phaseFrame: number, round: number): string {
  if (phase !== 'intro') return '';
  return phaseFrame < 60 ? `ROUND ${round}` : 'FIGHT!';
}

/** Health at or below 25 % pulses red. */
export function lowHealth(hp: number, max: number): boolean { return hp > 0 && hp * 4 <= max; }
/** Super meter is drawn as 4 segments; returns how many are completely full. */
export const METER_SEGMENTS = 4;
export function meterSegments(meter: number): number { return Math.max(0, Math.min(METER_SEGMENTS, Math.floor(meter * METER_SEGMENTS / METER_MAX))); }

// Preformatted strings: the per-frame draw path never concatenates (decision 0014).
const TIMER_STR = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));
const NUM_STR = Array.from({ length: 100 }, (_, i) => String(i));
const SEG_LABEL = Array.from({ length: METER_SEGMENTS + 1 }, (_, i) => `SUPER ${i}/${METER_SEGMENTS}`);
const ROUND_STR = Array.from({ length: 10 }, (_, i) => `ROUND ${i}`);
const FONT_LABEL = 'italic 900 10px system-ui', FONT_READY = 'italic 900 14px system-ui', FONT_COMBO = 'italic 900 34px system-ui';
const FONT_HITS = 'italic 900 16px system-ui', FONT_TIMER = '900 28px system-ui', FONT_ROUND = 'italic 900 52px system-ui';
const TOP_H = 56, BOTTOM_Y = 316, BOTTOM_H = 44;
const BAR_W = 250, BAR_H = 16, METER_W = 170, METER_H = 10;
const TRAIL_DELAY = 30, TRAIL_DRAIN = 4, COMBO_FADE = 60;

interface Side { trail: number; lastHp: number; idle: number; combo: number; comboFade: number }

export class Hud {
  private readonly sides: [Side, Side];
  private frame = 0;
  private readonly topKey: string;
  private readonly bottomKey: string;
  private readonly chars: readonly [CharId, CharId];
  constructor(state: MatchState) {
    this.chars = [state.fighters[0].char, state.fighters[1].char];
    this.topKey = `hud.top.${this.chars[0]}.${this.chars[1]}`;
    this.bottomKey = 'hud.bottom';
    const mk = (i: 0 | 1): Side => { const hp = state.fighters[i].hp; return { trail: hp, lastHp: hp, idle: 0, combo: 0, comboFade: 0 }; };
    this.sides = [mk(0), mk(1)];
  }

  /** Advance trail/combo timers once per simulated frame. */
  update(state: MatchState): void {
    this.frame++;
    state.fighters.forEach((f, i) => {
      const s = this.sides[i]!;
      if (f.hp < s.lastHp) s.idle = 0; else s.idle++;
      if (f.hp > s.trail) s.trail = f.hp; // new round refill
      if (s.idle > TRAIL_DELAY && s.trail > f.hp) s.trail = Math.max(f.hp, s.trail - TRAIL_DRAIN * CHARS[f.char].hp / BAR_W);
      s.lastHp = f.hp;
      // Combo is tracked on the defender's comboHits and shown on the attacker's side.
      const atk = this.sides[i === 0 ? 1 : 0]!;
      if (f.comboHits >= 2) { atk.combo = f.comboHits; atk.comboFade = COMBO_FADE; }
      else if (atk.comboFade > 0) atk.comboFade--;
    });
  }

  private grads: { ctx: CanvasRenderingContext2D; hp: CanvasGradient; low: CanvasGradient; trail: CanvasGradient; meter: CanvasGradient; full: CanvasGradient; gloss: CanvasGradient } | null = null;
  /** Gradients are built once per context (fixed HUD coordinates) and reused every frame. */
  private gradients(ctx: CanvasRenderingContext2D): NonNullable<Hud['grads']> {
    if (this.grads?.ctx === ctx) return this.grads;
    const v = (y0: number, y1: number, stops: [number, string][]): CanvasGradient => {
      const g = ctx.createLinearGradient(0, y0, 0, y1); for (const [o, c] of stops) g.addColorStop(o, c); return g;
    };
    this.grads = {
      ctx,
      hp: v(14, 14 + BAR_H, [[0, '#fff2a0'], [0.45, '#ffd84a'], [1, '#f08a1c']]),
      low: v(14, 14 + BAR_H, [[0, '#ffb0a0'], [0.45, '#ff5a3a'], [1, '#b0101a']]),
      trail: v(14, 14 + BAR_H, [[0, '#ff8a8a'], [1, '#a01828']]),
      meter: v(342, 342 + METER_H, [[0, '#9fd8ff'], [0.5, '#3a8bff'], [1, '#1d4fb8']]),
      full: v(342, 342 + METER_H, [[0, '#fff6c0'], [0.5, '#ffd84a'], [1, '#e08a10']]),
      gloss: v(14, 14 + BAR_H, [[0, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,0)']]),
    };
    return this.grads;
  }

  /** Static top strip: bar plates, name tags, empty round pips, timer plate. Painted once per character pair and scale. */
  private readonly paintTop = (g: CanvasRenderingContext2D): void => {
    g.lineJoin = 'round';
    for (const i of [0, 1] as const) {
      const dir = i === 0 ? -1 : 1, inner = 320 + dir * 34, x0 = dir < 0 ? inner - BAR_W : inner, ch = this.chars[i], acc = SKINS[ch].accent;
      g.beginPath();
      if (dir < 0) { g.moveTo(inner + 2, 11); g.lineTo(x0 - 10, 11); g.lineTo(x0 - 2, 16 + BAR_H); g.lineTo(inner + 2, 16 + BAR_H); }
      else { g.moveTo(inner - 2, 11); g.lineTo(inner + BAR_W + 10, 11); g.lineTo(inner + BAR_W + 2, 16 + BAR_H); g.lineTo(inner - 2, 16 + BAR_H); }
      g.closePath(); g.fillStyle = '#1b1b2a'; g.fill();
      g.fillStyle = '#3a2a3a'; g.fillRect(x0, 14, BAR_W, BAR_H);
      const name = CHARS[ch].name;
      g.font = 'italic 900 12px system-ui';
      const tw = g.measureText(name).width + 18, tx = dir < 0 ? x0 : inner + BAR_W - tw;
      g.beginPath(); g.moveTo(tx + 6, 33); g.lineTo(tx + tw, 33); g.lineTo(tx + tw - 6, 49); g.lineTo(tx, 49); g.closePath();
      g.fillStyle = acc; g.fill(); g.lineWidth = 2; g.strokeStyle = '#1b1b2a'; g.stroke();
      g.fillStyle = '#1b1b2a'; g.textAlign = 'center'; g.fillText(name, tx + tw / 2, 45);
      for (let p = 0; p < ROUNDS_TO_WIN; p++) { pipPath(g, inner + dir * (14 + p * 18), 41); g.fillStyle = '#2a2a3c'; g.fill(); g.lineWidth = 2; g.strokeStyle = '#1b1b2a'; g.stroke(); }
    }
    g.beginPath(); g.roundRect(296, 8, 48, 40, 8); g.fillStyle = '#1b1b2a'; g.fill();
    g.beginPath(); g.roundRect(299, 11, 42, 34, 6); g.fillStyle = '#2c2c48'; g.fill();
    g.lineWidth = 2; g.strokeStyle = '#ffd84a'; g.stroke();
  };
  /** Static bottom strip: meter plates. */
  private readonly paintBottom = (g: CanvasRenderingContext2D): void => {
    g.translate(0, -BOTTOM_Y);
    for (const dir of [-1, 1]) {
      const mx = dir < 0 ? 22 : 618 - METER_W;
      g.fillStyle = '#1b1b2a'; g.fillRect(mx - 3, 339, METER_W + 6, METER_H + 6);
      g.fillStyle = '#20203a'; g.fillRect(mx, 342, METER_W, METER_H);
    }
  };

  draw(ctx: CanvasRenderingContext2D, state: MatchState): void {
    const G = this.gradients(ctx);
    const top = getLayer(this.topKey) ?? cacheLayer(this.topKey, 640, TOP_H, this.paintTop);
    const bottom = getLayer(this.bottomKey) ?? cacheLayer(this.bottomKey, 640, BOTTOM_H, this.paintBottom);
    if (top) ctx.drawImage(top as unknown as CanvasImageSource, 0, 0, 640, TOP_H);
    if (bottom) ctx.drawImage(bottom as unknown as CanvasImageSource, 0, BOTTOM_Y, 640, BOTTOM_H);
    ctx.lineJoin = 'round';
    for (let i = 0; i < 2; i++) {
      const f = state.fighters[i]!, s = this.sides[i]!, dir = i === 0 ? -1 : 1, max = CHARS[f.char].hp;
      const inner = 320 + dir * 34, x0 = dir < 0 ? inner - BAR_W : inner;
      const trailW = BAR_W * Math.max(0, s.trail) / max, hpW = BAR_W * Math.max(0, f.hp) / max;
      ctx.fillStyle = G.trail; ctx.fillRect(dir < 0 ? inner - trailW : inner, 14, trailW, BAR_H);
      const low = lowHealth(f.hp, max);
      ctx.fillStyle = low ? G.low : G.hp; ctx.fillRect(dir < 0 ? inner - hpW : inner, 14, hpW, BAR_H);
      if (low) { ctx.globalAlpha = 0.25 + 0.25 * Math.sin(this.frame * 0.25); ctx.fillStyle = '#ffffff'; ctx.fillRect(dir < 0 ? inner - hpW : inner, 14, hpW, BAR_H); ctx.globalAlpha = 1; }
      ctx.fillStyle = G.gloss; ctx.fillRect(x0, 14, BAR_W, BAR_H);
      // Round-win pips: gold stars drawn over the cached empty ones.
      for (let p = 0; p < f.wins && p < ROUNDS_TO_WIN; p++) {
        const px = inner + dir * (14 + p * 18), py = 41;
        pipPath(ctx, px, py); ctx.fillStyle = '#ffd84a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1b1b2a'; ctx.stroke();
        ctx.beginPath(); ctx.arc(px - 1.5, py - 2, 1.6, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
      }
      // Segmented super meter with label.
      const full = f.meter >= METER_MAX, mx = dir < 0 ? 22 : 618 - METER_W;
      const mw = METER_W * Math.min(f.meter, METER_MAX) / METER_MAX;
      ctx.fillStyle = full ? G.full : G.meter;
      if (full && this.frame % 20 >= 10) ctx.fillStyle = '#fff6c0';
      ctx.fillRect(dir < 0 ? mx : mx + METER_W - mw, 342, mw, METER_H);
      ctx.fillStyle = '#1b1b2a'; ctx.beginPath();
      for (let k = 1; k < METER_SEGMENTS; k++) ctx.rect(mx + (METER_W * k) / METER_SEGMENTS - 1, 342, 2, METER_H);
      ctx.fill();
      hudText(ctx, full ? 'SUPER!' : SEG_LABEL[meterSegments(f.meter)]!, dir < 0 ? mx : mx + METER_W, 334, full ? FONT_READY : FONT_LABEL, full ? 3 : 3, full ? '#ffd84a' : '#bfe0ff', dir < 0 ? 'left' : 'right');
      if (s.comboFade > 0) {
        ctx.globalAlpha = Math.min(1, s.comboFade / 20);
        const cx = dir < 0 ? 24 : 616, al = dir < 0 ? 'left' : 'right';
        hudText(ctx, NUM_STR[s.combo] ?? String(s.combo), cx, 118, FONT_COMBO, 6.8, '#ffd84a', al);
        hudText(ctx, 'HITS', cx + (dir < 0 ? 1 : -1) * (s.combo >= 10 ? 44 : 24), 118, FONT_HITS, 3.2, '#ffffff', al);
        ctx.globalAlpha = 1;
      }
    }
    // Timer digits over the cached plate.
    const red = state.timer <= 600;
    hudText(ctx, TIMER_STR[Math.max(0, Math.min(99, Math.ceil(state.timer / 60)))]!, 320, 39, FONT_TIMER, 5.6, red && this.frame % 30 < 15 ? '#ff4040' : red ? '#ff8080' : '#ffffff', 'center');
    if (state.phase === 'intro') {
      const fight = state.phaseFrame >= 60;
      const k = Math.min(1, (state.phaseFrame % 60) / 8), sc = 0.6 + 0.4 * k;
      ctx.save(); ctx.translate(320, 180); ctx.scale(sc, sc);
      hudText(ctx, fight ? 'FIGHT!' : ROUND_STR[state.round] ?? roundText(state.phase, state.phaseFrame, state.round), 0, 0, FONT_ROUND, 10.4, fight ? '#ffd84a' : '#ffffff', 'center');
      ctx.restore();
    }
  }
}

/** Five-point star path centred at (px, py). */
function pipPath(g: CanvasRenderingContext2D, px: number, py: number): void {
  g.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 3.2 : 7.5; k ? g.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r) : g.moveTo(px + Math.cos(a) * r, py + Math.sin(a) * r); }
  g.closePath();
}
/** Outlined text; `font` and `lw` are precomputed constants so nothing is built per frame. */
function hudText(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, font: string, lw: number, color: string, align: CanvasTextAlign): void {
  ctx.font = font; ctx.textAlign = align;
  ctx.lineWidth = lw; ctx.strokeStyle = '#1b1b2a'; ctx.strokeText(t, x, y);
  ctx.fillStyle = color; ctx.fillText(t, x, y);
}
