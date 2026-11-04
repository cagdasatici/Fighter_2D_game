import { CHARS, METER_MAX, ROUNDS_TO_WIN, type MatchState } from '@kb/shared';
import { SKINS } from './Gallery.js';

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

const BAR_W = 250, BAR_H = 16, METER_W = 170, METER_H = 10;
const TRAIL_DELAY = 30, TRAIL_DRAIN = 4, COMBO_FADE = 60;

interface Side { trail: number; lastHp: number; idle: number; combo: number; comboFade: number }

export class Hud {
  private readonly sides: [Side, Side];
  private frame = 0;
  constructor(state: MatchState) {
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

  draw(ctx: CanvasRenderingContext2D, state: MatchState): void {
    const G = this.gradients(ctx);
    ctx.save();
    ctx.lineJoin = 'round';
    const text = (t: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign, italic = false): void => {
      ctx.font = `${italic ? 'italic ' : ''}900 ${size}px system-ui`; ctx.textAlign = align;
      ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = '#1b1b2a'; ctx.strokeText(t, x, y);
      ctx.fillStyle = color; ctx.fillText(t, x, y);
    };
    state.fighters.forEach((f, i) => {
      const s = this.sides[i]!, dir = i === 0 ? -1 : 1, max = CHARS[f.char].hp, acc = SKINS[f.char].accent;
      const inner = 320 + dir * 34; // bars grow outward from the centre timer
      const x0 = dir < 0 ? inner - BAR_W : inner;
      // Frame: dark plate with a slanted outer end.
      ctx.beginPath();
      if (dir < 0) { ctx.moveTo(inner + 2, 11); ctx.lineTo(x0 - 10, 11); ctx.lineTo(x0 - 2, 16 + BAR_H); ctx.lineTo(inner + 2, 16 + BAR_H); }
      else { ctx.moveTo(inner - 2, 11); ctx.lineTo(inner + BAR_W + 10, 11); ctx.lineTo(inner + BAR_W + 2, 16 + BAR_H); ctx.lineTo(inner - 2, 16 + BAR_H); }
      ctx.closePath(); ctx.fillStyle = '#1b1b2a'; ctx.fill();
      ctx.fillStyle = '#3a2a3a'; ctx.fillRect(x0, 14, BAR_W, BAR_H);
      const trailW = BAR_W * Math.max(0, s.trail) / max, hpW = BAR_W * Math.max(0, f.hp) / max;
      ctx.fillStyle = G.trail; ctx.fillRect(dir < 0 ? inner - trailW : inner, 14, trailW, BAR_H);
      const low = lowHealth(f.hp, max);
      ctx.fillStyle = low ? G.low : G.hp; ctx.fillRect(dir < 0 ? inner - hpW : inner, 14, hpW, BAR_H);
      if (low) { ctx.globalAlpha = 0.25 + 0.25 * Math.sin(this.frame * 0.25); ctx.fillStyle = '#ffffff'; ctx.fillRect(dir < 0 ? inner - hpW : inner, 14, hpW, BAR_H); ctx.globalAlpha = 1; }
      ctx.fillStyle = G.gloss; ctx.fillRect(x0, 14, BAR_W, BAR_H);
      // Name tag in the character colour.
      const name = CHARS[f.char].name;
      ctx.font = 'italic 900 12px system-ui';
      const tw = ctx.measureText(name).width + 18, tx = dir < 0 ? x0 : inner + BAR_W - tw;
      ctx.beginPath(); ctx.moveTo(tx + 6, 33); ctx.lineTo(tx + tw, 33); ctx.lineTo(tx + tw - 6, 49); ctx.lineTo(tx, 49); ctx.closePath();
      ctx.fillStyle = acc; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1b1b2a'; ctx.stroke();
      ctx.fillStyle = '#1b1b2a'; ctx.textAlign = 'center'; ctx.fillText(name, tx + tw / 2, 45);
      // Round-win pips: gold stars when won.
      for (let p = 0; p < ROUNDS_TO_WIN; p++) {
        const px = inner + dir * (14 + p * 18), py = 41, won = f.wins > p;
        ctx.beginPath();
        for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 3.2 : 7.5; k ? ctx.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r) : ctx.moveTo(px + Math.cos(a) * r, py + Math.sin(a) * r); }
        ctx.closePath(); ctx.fillStyle = won ? '#ffd84a' : '#2a2a3c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1b1b2a'; ctx.stroke();
        if (won) { ctx.beginPath(); ctx.arc(px - 1.5, py - 2, 1.6, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill(); }
      }
      // Segmented super meter with label.
      const full = f.meter >= METER_MAX, mx = dir < 0 ? 22 : 618 - METER_W;
      ctx.fillStyle = '#1b1b2a'; ctx.fillRect(mx - 3, 339, METER_W + 6, METER_H + 6);
      ctx.fillStyle = '#20203a'; ctx.fillRect(mx, 342, METER_W, METER_H);
      const mw = METER_W * Math.min(f.meter, METER_MAX) / METER_MAX;
      ctx.fillStyle = full ? G.full : G.meter;
      if (full && this.frame % 20 >= 10) ctx.fillStyle = '#fff6c0';
      ctx.fillRect(dir < 0 ? mx : mx + METER_W - mw, 342, mw, METER_H);
      ctx.fillStyle = '#1b1b2a';
      for (let k = 1; k < METER_SEGMENTS; k++) ctx.fillRect(mx + (METER_W * k) / METER_SEGMENTS - 1, 342, 2, METER_H);
      const segs = meterSegments(f.meter);
      text(full ? 'SUPER!' : `SUPER ${segs}/${METER_SEGMENTS}`, dir < 0 ? mx : mx + METER_W, 334, full ? 14 : 10, full ? '#ffd84a' : '#bfe0ff', dir < 0 ? 'left' : 'right', true);
      if (s.comboFade > 0) {
        ctx.globalAlpha = Math.min(1, s.comboFade / 20);
        const cx = dir < 0 ? 24 : 616, al = dir < 0 ? 'left' : 'right';
        text(String(s.combo), cx, 118, 34, '#ffd84a', al, true);
        text('HITS', cx + (dir < 0 ? 1 : -1) * (s.combo >= 10 ? 44 : 24), 118, 16, '#ffffff', al, true);
        ctx.globalAlpha = 1;
      }
    });
    // Timer plate.
    ctx.beginPath(); ctx.roundRect(296, 8, 48, 40, 8); ctx.fillStyle = '#1b1b2a'; ctx.fill();
    ctx.beginPath(); ctx.roundRect(299, 11, 42, 34, 6); ctx.fillStyle = '#2c2c48'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#ffd84a'; ctx.stroke();
    const red = state.timer <= 600;
    text(timerDigits(state.timer), 320, 39, 28, red && this.frame % 30 < 15 ? '#ff4040' : red ? '#ff8080' : '#ffffff', 'center');
    const rt = roundText(state.phase, state.phaseFrame, state.round);
    if (rt) {
      const k = Math.min(1, (state.phaseFrame % 60) / 8);
      ctx.save(); ctx.translate(320, 180); ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
      text(rt, 0, 0, 52, rt === 'FIGHT!' ? '#ffd84a' : '#ffffff', 'center', true);
      ctx.restore();
    }
    ctx.restore();
  }
}
