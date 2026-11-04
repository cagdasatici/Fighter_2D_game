import { CHARS, METER_MAX, ROUNDS_TO_WIN, type MatchState } from '@kb/shared';

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

const BAR_W = 260, BAR_H = 14, METER_W = 180, METER_H = 8;
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

  draw(ctx: CanvasRenderingContext2D, state: MatchState): void {
    ctx.save();
    ctx.lineJoin = 'round';
    const text = (t: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign): void => {
      ctx.font = `bold ${size}px system-ui`; ctx.textAlign = align;
      ctx.lineWidth = 3; ctx.strokeStyle = '#1b1b2a'; ctx.strokeText(t, x, y);
      ctx.fillStyle = color; ctx.fillText(t, x, y);
    };
    state.fighters.forEach((f, i) => {
      const s = this.sides[i]!, dir = i === 0 ? -1 : 1, max = CHARS[f.char].hp;
      const inner = 320 + dir * 30; // bars grow outward from the centre timer
      const barX = (w: number): number => (dir < 0 ? inner - w : inner);
      ctx.fillStyle = '#1b1b2a'; ctx.fillRect(barX(BAR_W) - 2, 12, BAR_W + 4, BAR_H + 4);
      const trailW = BAR_W * Math.max(0, s.trail) / max, hpW = BAR_W * Math.max(0, f.hp) / max;
      ctx.fillStyle = '#d23030'; ctx.fillRect(dir < 0 ? inner - trailW : inner, 14, trailW, BAR_H);
      ctx.fillStyle = '#ffd84a'; ctx.fillRect(dir < 0 ? inner - hpW : inner, 14, hpW, BAR_H);
      text(CHARS[f.char].name, dir < 0 ? inner - BAR_W : inner + BAR_W, 44, 12, '#ffffff', dir < 0 ? 'left' : 'right');
      for (let p = 0; p < ROUNDS_TO_WIN; p++) {
        ctx.beginPath(); ctx.arc(inner + dir * (12 + p * 14), 40, 5, 0, Math.PI * 2);
        ctx.fillStyle = f.wins > p ? '#ffd84a' : '#3a3a4a'; ctx.fill();
        ctx.lineWidth = 1.5; ctx.strokeStyle = '#1b1b2a'; ctx.stroke();
      }
      // Meter
      const full = f.meter >= METER_MAX, mx = dir < 0 ? 20 : 620 - METER_W;
      ctx.fillStyle = '#1b1b2a'; ctx.fillRect(mx - 2, 340, METER_W + 4, METER_H + 4);
      const mw = METER_W * Math.min(f.meter, METER_MAX) / METER_MAX;
      ctx.fillStyle = full && this.frame % 20 < 10 ? '#ffd84a' : '#3a8bff';
      ctx.fillRect(dir < 0 ? mx : mx + METER_W - mw, 342, mw, METER_H);
      if (full) text('SUPER!', dir < 0 ? mx : mx + METER_W, 334, 12, '#ffd84a', dir < 0 ? 'left' : 'right');
      if (s.comboFade > 0) {
        ctx.globalAlpha = Math.min(1, s.comboFade / 20);
        text(comboText(s.combo), dir < 0 ? 24 : 616, 110, 20, '#ffffff', dir < 0 ? 'left' : 'right');
        ctx.globalAlpha = 1;
      }
    });
    text(timerDigits(state.timer), 320, 40, 32, state.timer <= 600 ? '#ff4040' : '#ffffff', 'center');
    const rt = roundText(state.phase, state.phaseFrame, state.round);
    if (rt) text(rt, 320, 170, 40, '#ffffff', 'center');
    ctx.restore();
  }
}
