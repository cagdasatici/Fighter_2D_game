import { textSprite, type TextSprite } from './Layers.js';
import { PX, SUPER_FREEZE_FRAMES, type FxEvent, type MatchState } from '@kb/shared';

/** Spec §9.4. Render-only; never mutates sim state. */
export const POOL_SIZE = 256;
export type ParticleKind = 'line' | 'dot' | 'ring' | 'chevron' | 'star' | 'shield' | 'sparkle' | 'puff';
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; color: string; kind: ParticleKind; alive: boolean }
export interface Banner { text: string; x: number; y: number; life: number; max: number; color: string; scaleFrom: number; centred: boolean; sprite: TextSprite | null }

const DT = 1 / 60;
const BANNERS = 8;

export class Fx {
  readonly pool: Particle[] = Array.from({ length: POOL_SIZE }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 0, color: '#fff', kind: 'dot' as ParticleKind, alive: false }));
  readonly banners: Banner[] = Array.from({ length: BANNERS }, () => ({ text: '', x: 0, y: 0, life: 0, max: 1, color: '#fff', scaleFrom: 1, centred: false, sprite: null }));
  /** Last sim frame whose events were consumed; guarantees each frame's events fire exactly once. */
  lastFxFrame = -1;
  flash = 0;          // white screen-flash frames left
  koFlashes = 0;      // frames left of the 3-flash KO sequence
  superLeft = 0;      // super dim/banner frames left
  superBy: 0 | 1 = 0;
  superName = '';
  private cursor = 0;
  /** Set by the game loop when frames run long: halves the particle cap (decision 0014). */
  lowFx = false;

  koLeft = 0;         // frames left of the K.O. vignette/slow-down look
  private tick = 0;

  constructor(
    private readonly nameOf: (by: 0 | 1) => string = () => '',
    private readonly accentOf: (by: 0 | 1) => string = () => '#ffffff',
    /** Draws the super user's portrait inside the cut-in band (origin = band centre-left). */
    private readonly portraitOf: (ctx: CanvasRenderingContext2D, by: 0 | 1, x: number, y: number) => void = () => {},
  ) {}

  get liveCount(): number { let n = 0; for (const p of this.pool) if (p.alive) n++; return n; }

  /** Call once per simulated frame after `step()`. Spawns from `state.events` unless that frame was already consumed. */
  consume(state: MatchState): void {
    if (state.frame === this.lastFxFrame) return;
    this.lastFxFrame = state.frame;
    for (const e of state.events) this.spawnEvent(e, state);
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, r: number, color: string, kind: ParticleKind): void {
    // Ring-buffer reuse: the pool never grows, oldest particles are overwritten.
    const cap = this.lowFx ? POOL_SIZE >> 1 : POOL_SIZE;
    if (this.cursor >= cap) this.cursor = 0;
    const p = this.pool[this.cursor]!;
    this.cursor++;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.r = r; p.color = color; p.kind = kind; p.alive = true;
  }

  private banner(text: string, x: number, y: number, life: number, color: string, scaleFrom = 1): void {
    let slot = this.banners[0]!;
    for (const b of this.banners) if (b.life < slot.life) slot = b;
    // Stroked text is pre-rendered to a sprite once per string (built at spawn, drawn every frame).
    const centred = text === 'K.O.';
    slot.centred = centred;
    slot.sprite = centred
      ? textSprite(text, { font: 'italic 900 72px system-ui', fill: '#ffd84a', outline: '#1b1b2a', outlineWidth: 10, accent: '#e63946', accentWidth: 2 }, 280, 130)
      : textSprite(text, { font: 'italic 900 22px system-ui', fill: color, outline: '#1b1b2a', outlineWidth: 6 }, 150, 50);
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
          this.spawn(x, y, Math.cos(a + e.strength) * r * 6, Math.sin(a + e.strength) * r * 6, 8, r * 0.6, e.kind === 'counter' ? '#ff6a3b' : '#ffd84a', 'line');
        }
        this.spawn(x, y, 0, 0, 7 + e.strength * 2, r * 0.9, '#ffffff', 'star');
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
        this.spawn(x, y, away * 20, 0, 9, 18, '#59c8ff', 'shield');
        for (let i = 0; i < 3; i++) this.spawn(x, y + (i - 1) * 10, away * 180, (i - 1) * 60, 7, 6, '#bfeaff', 'chevron');
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
        this.koFlashes = 18; this.koLeft = 90;
        this.banner('K.O.', 0, 0, 90, '#ffffff', 3);
        break;
      case 'land':
        for (let i = 0; i < 4; i++) this.spawn(x + (i - 1.5) * 10, y - 60, (i - 1.5) * 40, 20, 14, 3 + i, '#cfc8bc', 'puff');
        break;
      case 'projectileClash':
        this.flash = Math.max(this.flash, 1);
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.spawn(x, y, Math.cos(a) * 160, Math.sin(a) * 160, 10, 2, '#ffffff', 'line'); }
        break;
      case 'special': {
        const c = this.accentOf(e.by);
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; this.spawn(x, y - 10, Math.cos(a) * 70, Math.sin(a) * 70 + 40, 16, 4, c, 'sparkle'); }
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
    if (this.koLeft > 0) this.koLeft--;
    this.tick++;
  }

  /** Super dim layer; the scene draws the attacker after this call. */
  drawDim(ctx: CanvasRenderingContext2D): void {
    if (this.superLeft <= 0) return;
    ctx.fillStyle = 'rgba(8,4,20,0.62)'; ctx.fillRect(0, 0, 640, 360);
    // Moving diagonal speed lines in the attacker's accent colour.
    ctx.strokeStyle = this.accentOf(this.superBy); ctx.lineCap = 'butt';
    for (let i = 0; i < 9; i++) {
      const off = ((this.tick * 18 + i * 97) % 900) - 130;
      ctx.globalAlpha = 0.18 + (i % 3) * 0.1; ctx.lineWidth = 2 + (i % 3) * 2;
      ctx.beginPath(); ctx.moveTo(off - 120, 360); ctx.lineTo(off + 90, 0); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Particles, banners and screen flashes. `sx/sy` map world px (y up) to screen. */
  draw(ctx: CanvasRenderingContext2D, sx: (x: number) => number, sy: (y: number) => number): void {
    ctx.save(); // one save/restore for the whole batch, none per particle
    ctx.lineWidth = 2; ctx.lineJoin = 'round';
    let lastColor = '';
    for (const p of this.pool) {
      if (!p.alive) continue;
      const k = p.life / p.max, x = sx(p.x), y = sy(p.y);
      ctx.globalAlpha = Math.max(0, k);
      if (p.color !== lastColor) { ctx.strokeStyle = p.color; ctx.fillStyle = p.color; lastColor = p.color; }
      if (p.kind === 'line') {
        // Tapered spike: wide at the inner end, sharp at the tip.
        const len = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / len, uy = -p.vy / len, w = 1 + p.r * 0.18 * k;
        ctx.beginPath(); ctx.moveTo(x - ux * p.r - uy * w, y - uy * p.r + ux * w); ctx.lineTo(x + ux * p.r, y + uy * p.r);
        ctx.lineTo(x - ux * p.r + uy * w, y - uy * p.r - ux * w); ctx.closePath(); ctx.fill();
      } else if (p.kind === 'star') {
        // Four-point impact star with a white core, grows then fades.
        const r = p.r * (0.6 + (1 - k) * 0.7), q = r * 0.28;
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + q, y - q); ctx.lineTo(x + r, y); ctx.lineTo(x + q, y + q);
        ctx.lineTo(x, y + r); ctx.lineTo(x - q, y + q); ctx.lineTo(x - r, y); ctx.lineTo(x - q, y - q); ctx.closePath();
        ctx.fillStyle = '#fff6c8'; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, r * 0.32, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
        lastColor = '';
      } else if (p.kind === 'shield') {
        // Hexagonal guard flash facing away from the attacker.
        const d = p.vx >= 0 ? 1 : -1, r = p.r * (1.1 - k * 0.3);
        ctx.lineWidth = 3; ctx.beginPath();
        for (let i = 0; i <= 4; i++) { const a = (-60 + i * 30) * Math.PI / 180; const px = x + Math.cos(a) * r * d, py = y + Math.sin(a) * r * 1.3; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke(); ctx.globalAlpha *= 0.35; ctx.lineTo(x, y); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2;
      } else if (p.kind === 'sparkle') {
        const r = p.r * k;
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.3, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.3, y); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x, y + r * 0.3); ctx.lineTo(x + r, y); ctx.lineTo(x, y - r * 0.3); ctx.closePath(); ctx.fill();
      } else if (p.kind === 'puff') {
        ctx.globalAlpha = Math.max(0, k * 0.7);
        ctx.beginPath(); ctx.arc(x, y, p.r * (1.6 - k * 0.6), 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'ring') {
        ctx.beginPath(); ctx.arc(x, y, p.r * (1 - k * 0.5), 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === 'chevron') {
        const d = p.vx >= 0 ? 1 : -1;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - d * p.r, y - p.r); ctx.lineTo(x, y); ctx.lineTo(x - d * p.r, y + p.r); ctx.stroke(); ctx.lineWidth = 2;
      } else { ctx.beginPath(); ctx.arc(x, y, p.r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    if (this.koLeft > 0) this.drawKoVignette(ctx);
    for (const b of this.banners) {
      if (b.life <= 0 || !b.sprite) continue;
      const t = 1 - b.life / b.max, scale = b.scaleFrom + (1 - b.scaleFrom) * Math.min(1, t * 6);
      const w = b.sprite.w * scale, h = b.sprite.h * scale;
      ctx.globalAlpha = Math.min(1, b.life / 10);
      ctx.drawImage(b.sprite.canvas as unknown as CanvasImageSource, (b.centred ? 320 : sx(b.x)) - w / 2, (b.centred ? 190 : sy(b.y)) - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
    if (this.superLeft > 0) this.drawCutIn(ctx);
    if (this.flash > 0 || (this.koFlashes > 0 && this.koFlashes % 6 >= 3)) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(0, 0, 640, 360);
    }
    ctx.restore();
  }

  /** Super cut-in: slanted accent band slides in with the attacker's portrait and name. */
  private drawCutIn(ctx: CanvasRenderingContext2D): void {
    const elapsed = SUPER_FREEZE_FRAMES - this.superLeft;
    const slide = Math.min(1, elapsed / 10), out = this.superLeft < 8 ? this.superLeft / 8 : 1;
    const left = this.superBy === 0, acc = this.accentOf(this.superBy);
    const off = (1 - slide) * 700 * (left ? -1 : 1);
    ctx.save();
    ctx.globalAlpha = out;
    ctx.translate(off, 0);
    ctx.beginPath(); ctx.moveTo(0, 214); ctx.lineTo(640, 184); ctx.lineTo(640, 264); ctx.lineTo(0, 294); ctx.closePath();
    ctx.fillStyle = '#1b1b2a'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 220); ctx.lineTo(640, 190); ctx.lineTo(640, 258); ctx.lineTo(0, 288); ctx.closePath();
    ctx.fillStyle = acc; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 6;
    for (let i = 0; i < 12; i++) { const x = ((i * 70 + elapsed * 22 * (left ? 1 : -1)) % 840 + 840) % 840 - 100; ctx.beginPath(); ctx.moveTo(x, 300); ctx.lineTo(x + 50, 180); ctx.stroke(); }
    this.portraitOf(ctx, this.superBy, left ? 110 : 530, 300);
    ctx.restore();
    ctx.font = 'italic 900 30px system-ui'; ctx.textAlign = left ? 'left' : 'right'; ctx.lineJoin = 'round';
    const tx = left ? 200 : 440, ty = left ? 252 : 246;
    ctx.lineWidth = 6; ctx.strokeStyle = '#1b1b2a'; ctx.strokeText(this.superName, tx, ty);
    ctx.fillStyle = '#ffffff'; ctx.fillText(this.superName, tx, ty);
    ctx.restore();
  }

  /** K.O. look: darkened edges and a warm centre flash that fades over `koLeft`. */
  private drawKoVignette(ctx: CanvasRenderingContext2D): void {
    const v = vignette();
    if (!v) return;
    ctx.globalAlpha = Math.min(1, this.koLeft / 30);
    ctx.drawImage(v, 0, 0, 640, 360);
    ctx.globalAlpha = 1;
  }
}

let vig: HTMLCanvasElement | null = null;
/** Pre-rendered K.O. vignette (built once, reused every frame). */
function vignette(): HTMLCanvasElement | null {
  if (vig || typeof document === 'undefined') return vig;
  const c = document.createElement('canvas'); c.width = 320; c.height = 180;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createRadialGradient(160, 90, 30, 160, 90, 190);
  grad.addColorStop(0, 'rgba(255,240,200,0.25)'); grad.addColorStop(0.55, 'rgba(120,10,30,0.15)'); grad.addColorStop(1, 'rgba(10,0,10,0.85)');
  g.fillStyle = grad; g.fillRect(0, 0, 320, 180);
  vig = c;
  return vig;
}
