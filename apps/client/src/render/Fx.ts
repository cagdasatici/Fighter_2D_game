import { PX, SUPER_FREEZE_FRAMES, type FxEvent, type MatchState } from '@kb/shared';

/** Spec §9.4. Render-only; never mutates sim state. */
export const POOL_SIZE = 256;
export type ParticleKind = 'line' | 'dot' | 'ring' | 'chevron';
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; color: string; kind: ParticleKind; alive: boolean }
export interface Banner { text: string; x: number; y: number; life: number; max: number; color: string; scaleFrom: number }

const DT = 1 / 60;
const BANNERS = 8;

export class Fx {
  readonly pool: Particle[] = Array.from({ length: POOL_SIZE }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 0, color: '#fff', kind: 'dot' as ParticleKind, alive: false }));
  readonly banners: Banner[] = Array.from({ length: BANNERS }, () => ({ text: '', x: 0, y: 0, life: 0, max: 1, color: '#fff', scaleFrom: 1 }));
  /** Last sim frame whose events were consumed; guarantees each frame's events fire exactly once. */
  lastFxFrame = -1;
  flash = 0;          // white screen-flash frames left
  koFlashes = 0;      // frames left of the 3-flash KO sequence
  superLeft = 0;      // super dim/banner frames left
  superBy: 0 | 1 = 0;
  superName = '';
  private cursor = 0;

  constructor(private readonly nameOf: (by: 0 | 1) => string = () => '', private readonly accentOf: (by: 0 | 1) => string = () => '#ffffff') {}

  get liveCount(): number { let n = 0; for (const p of this.pool) if (p.alive) n++; return n; }

  /** Call once per simulated frame after `step()`. Spawns from `state.events` unless that frame was already consumed. */
  consume(state: MatchState): void {
    if (state.frame === this.lastFxFrame) return;
    this.lastFxFrame = state.frame;
    for (const e of state.events) this.spawnEvent(e, state);
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, r: number, color: string, kind: ParticleKind): void {
    // Ring-buffer reuse: the pool never grows, oldest particles are overwritten.
    const p = this.pool[this.cursor]!;
    this.cursor = (this.cursor + 1) % POOL_SIZE;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.r = r; p.color = color; p.kind = kind; p.alive = true;
  }

  private banner(text: string, x: number, y: number, life: number, color: string, scaleFrom = 1): void {
    let slot = this.banners[0]!;
    for (const b of this.banners) if (b.life < slot.life) slot = b;
    slot.text = text; slot.x = x; slot.y = y; slot.life = life; slot.max = life; slot.color = color; slot.scaleFrom = scaleFrom;
  }

  private spawnEvent(e: FxEvent, state: MatchState): void {
    // World px, y up. Burst directions use a fixed angle table (render-side, floats allowed).
    const x = e.x / PX, y = e.y / PX;
    switch (e.kind) {
      case 'hit': case 'counter': case 'throw': {
        const n = [6, 8, 10][e.strength]!, r = [10, 16, 24][e.strength]!;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          this.spawn(x, y, Math.cos(a) * r * 6, Math.sin(a) * r * 6, 8, r * 0.5, '#ffd84a', 'line');
        }
        this.spawn(x, y, 0, 0, 6, r * 0.4, '#ffffff', 'dot');
        if (e.strength === 2) this.flash = Math.max(this.flash, 1);
        if (e.kind === 'counter') {
          this.spawn(x, y, 0, 0, 20, 30, '#ff3b3b', 'ring');
          const d = state.fighters[e.by === 0 ? 1 : 0];
          this.banner('COUNTER', d.x / PX, d.y / PX + 130, 30, '#ff3b3b');
        }
        break;
      }
      case 'block': {
        const away = state.fighters[e.by].x <= e.x ? 1 : -1;
        for (let i = 0; i < 3; i++) this.spawn(x, y + (i - 1) * 10, away * 180, (i - 1) * 60, 6, 6, '#59c8ff', 'chevron');
        break;
      }
      case 'parry':
        this.spawn(x, y, 0, 0, 20, 40, '#3ddc97', 'ring');
        this.banner('PARRY', x, y + 70, 30, '#3ddc97');
        break;
      case 'super':
        this.superLeft = SUPER_FREEZE_FRAMES; this.superBy = e.by; this.superName = this.nameOf(e.by);
        break;
      case 'ko':
        this.koFlashes = 18;
        this.banner('K.O.', 0, 0, 90, '#ffffff', 3);
        break;
      case 'land':
        for (let i = 0; i < 4; i++) this.spawn(x + (i - 1.5) * 10, y - 60, (i - 1.5) * 40, 20, 12, 3 + i, '#9a9a9a', 'dot');
        break;
      case 'projectileClash':
        this.flash = Math.max(this.flash, 1);
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.spawn(x, y, Math.cos(a) * 160, Math.sin(a) * 160, 10, 2, '#ffffff', 'line'); }
        break;
      case 'special': {
        const c = this.accentOf(e.by);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; this.spawn(x, y - 10, Math.cos(a) * 70, Math.sin(a) * 70 + 40, 14, 2, c, 'dot'); }
        break;
      }
      case 'whiff': break;
    }
  }

  /** Advance particles and overlays by one fixed 1/60 s tick. No allocation. */
  update(): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.x += p.vx * DT; p.y += p.vy * DT;
      if (--p.life <= 0) p.alive = false;
    }
    for (const b of this.banners) if (b.life > 0) b.life--;
    if (this.flash > 0) this.flash--;
    if (this.koFlashes > 0) this.koFlashes--;
    if (this.superLeft > 0) this.superLeft--;
  }

  /** Super dim layer; the scene draws the attacker after this call. */
  drawDim(ctx: CanvasRenderingContext2D): void {
    if (this.superLeft <= 0) return;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, 640, 360);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-60 + i * 260, 360); ctx.lineTo(200 + i * 260, 0); ctx.stroke(); }
  }

  /** Particles, banners and screen flashes. `sx/sy` map world px (y up) to screen. */
  draw(ctx: CanvasRenderingContext2D, sx: (x: number) => number, sy: (y: number) => number): void {
    ctx.save();
    for (const p of this.pool) {
      if (!p.alive) continue;
      const k = p.life / p.max, x = sx(p.x), y = sy(p.y);
      ctx.globalAlpha = Math.max(0, k);
      ctx.strokeStyle = p.color; ctx.fillStyle = p.color; ctx.lineWidth = 2;
      if (p.kind === 'line') {
        const len = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / len, uy = -p.vy / len;
        ctx.beginPath(); ctx.moveTo(x - ux * p.r, y - uy * p.r); ctx.lineTo(x + ux * p.r, y + uy * p.r); ctx.stroke();
      } else if (p.kind === 'ring') {
        ctx.beginPath(); ctx.arc(x, y, p.r * (1 - k * 0.5), 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === 'chevron') {
        const d = p.vx >= 0 ? 1 : -1;
        ctx.beginPath(); ctx.moveTo(x - d * p.r, y - p.r); ctx.lineTo(x, y); ctx.lineTo(x - d * p.r, y + p.r); ctx.stroke();
      } else { ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    for (const b of this.banners) {
      if (b.life <= 0) continue;
      const centred = b.text === 'K.O.';
      const t = 1 - b.life / b.max, scale = b.scaleFrom + (1 - b.scaleFrom) * Math.min(1, t * 6);
      ctx.save();
      ctx.translate(centred ? 320 : sx(b.x), centred ? 170 : sy(b.y)); ctx.scale(scale, scale);
      ctx.font = centred ? 'bold 64px system-ui' : 'bold 22px system-ui';
      ctx.lineWidth = 3; ctx.strokeStyle = '#1b1b2a'; ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color; ctx.fillText(b.text, 0, 0);
      ctx.restore();
    }
    if (this.superLeft > 0) {
      const slide = Math.min(1, (SUPER_FREEZE_FRAMES - this.superLeft) / 12);
      const left = this.superBy === 0;
      const w = 260, bx = left ? -w + w * slide : 640 - w * slide;
      ctx.fillStyle = this.accentOf(this.superBy); ctx.fillRect(bx, 250, w, 40);
      ctx.fillStyle = '#1b1b2a'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = left ? 'left' : 'right';
      ctx.fillText(this.superName, left ? bx + 12 : bx + w - 12, 278);
    }
    if (this.flash > 0 || (this.koFlashes > 0 && this.koFlashes % 6 >= 3)) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(0, 0, 640, 360);
    }
    ctx.restore();
  }
}
