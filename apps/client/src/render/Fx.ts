import { textSprite, type TextSprite } from './Layers.js';
import { drawGlow, hash01 } from './Projectiles.js';
import { PX, SUPER_FREEZE_FRAMES, type FxEvent, type MatchState } from '@kb/shared';

/** Spec §9.4. Render-only; never mutates sim state. */
export const POOL_SIZE = 256;
export type ParticleKind = 'line' | 'dot' | 'ring' | 'chevron' | 'star' | 'shield' | 'sparkle' | 'puff' | 'debris' | 'shock' | 'streak' | 'glow';
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; r: number; r1: number; color: string; kind: ParticleKind; alive: boolean }
export interface Banner { text: string; x: number; y: number; life: number; max: number; color: string; scaleFrom: number; centred: boolean; sprite: TextSprite | null }

const DT = 1 / 60;
const BANNERS = 8;

export class Fx {
  readonly pool: Particle[] = Array.from({ length: POOL_SIZE }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, r: 0, r1: 0, color: '#fff', kind: 'dot' as ParticleKind, alive: false }));
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
  /** Frames of white silhouette flash left per fighter (hit = 1-2 f, K.O. = 3 pulses on the loser). */
  readonly hitFlash: [number, number] = [0, 0];
  koLoser: 0 | 1 = 0;
  parryLeft = 0;      // frames of background desaturation after a parry
  superFlash = 0;     // frames left of the accent full-screen flash on a super
  superX = 0; superY = 0;
  crackLeft = 0; crackX = 0; crackY = 0;
  private tick = 0;
  private koBannerDue = false;
  /** Previous fighter states for dust/dash detection (no allocation). */
  private prevState: [string, string] = ['', ''];

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
    this.observeMotion(state);
  }

  /** Jump take-off dust and dash streaks, derived from state transitions (the sim emits no events for them). */
  private observeMotion(state: MatchState): void {
    for (let i = 0; i < 2; i++) {
      const f = state.fighters[i]!, was = this.prevState[i]!;
      if (f.state !== was) {
        const x = f.x / PX, y = f.y / PX;
        if (was === 'jumpSquat' && f.state === 'air') this.dust(x, y, 4);
        else if (f.state === 'dashF' || f.state === 'dashB') {
          const d = f.facing * (f.state === 'dashF' ? 1 : -1);
          this.dust(x, y, 3);
          for (let k = 0; k < 3; k++) this.spawn(x - d * 14, y + 14 + k * 16, -d * 360, 0, 8, 22 - k * 4, '#ffffff', 'streak');
        }
        this.prevState[i] = f.state;
      }
    }
  }
  private dust(x: number, y: number, n: number): void {
    const m = this.lowFx ? (n >> 1) + 1 : n;
    for (let i = 0; i < m; i++) this.spawn(x + (i - m / 2) * 9, y + 2, (i - m / 2 + 0.5) * 36, 18 + (i & 1) * 10, 16, 4 + (i & 3), '#cfc8bc', 'puff');
  }

  private spawn(x: number, y: number, vx: number, vy: number, life: number, r: number, color: string, kind: ParticleKind, r1 = 0): void {
    // Ring-buffer reuse: the pool never grows, oldest particles are overwritten.
    const cap = this.lowFx ? POOL_SIZE >> 1 : POOL_SIZE;
    if (this.cursor >= cap) this.cursor = 0;
    const p = this.pool[this.cursor]!;
    this.cursor++;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.r = r; p.r1 = r1; p.color = color; p.kind = kind; p.alive = true;
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
        const st = e.strength, half = this.lowFx ? 0.5 : 1;
        const n = Math.ceil([6, 9, 12][st]! * half), nd = Math.ceil([4, 8, 14][st]! * half), r = [10, 16, 24][st]!;
        const atk = state.fighters[e.by], dIdx = e.by === 0 ? 1 : 0, def = state.fighters[dIdx];
        const dir = def.x >= atk.x ? 1 : -1; // knockback direction
        const hot = e.kind === 'counter', c1 = hot ? '#ff6a3b' : '#ffd84a';
        // Radial spikes.
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + st;
          this.spawn(x, y, Math.cos(a) * r * 6, Math.sin(a) * r * 6, 9, r * 1.6, c1, 'line');
        }
        // Debris sparks with gravity, thrown mostly along the knockback.
        for (let i = 0; i < nd; i++) {
          const h1 = hash01(state.frame * 17 + i), h2 = hash01(state.frame * 31 + i * 5);
          this.spawn(x, y, dir * (50 + h1 * 190) + (h2 - 0.5) * 80, 90 + h2 * 230, 16 + (i & 7), 1.5 + (i & 1) * 1.2, i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? c1 : '#ff9a3b', 'debris');
        }
        // Expanding shockwave ring (r 8 -> 28/40/56 over 10 f) and the impact star.
        this.spawn(x, y, 0, 0, 10, 8, hot ? '#ff6a3b' : '#ffffff', 'shock', [28, 40, 56][st]!);
        this.spawn(x, y, 0, 0, 7 + st * 2, r * 1.3, '#ffffff', 'star');
        this.spawn(x, y, 0, 0, 6, r * 3, hot ? '#ff6a3b' : '#ffd84a', 'glow');
        // Streak lines along the knockback.
        for (let i = 0; i <= st; i++) this.spawn(x, y + (i - st / 2) * 9, dir * 520, 0, 7, 16 + st * 7, '#ffffff', 'streak');
        this.hitFlash[dIdx] = st === 2 ? 2 : 1;
        if (st === 2) this.flash = Math.max(this.flash, 1);
        if (hot) {
          this.spawn(x, y, 0, 0, 20, 30, '#ff3b3b', 'ring');
          this.banner('COUNTER', def.x / PX, def.y / PX + 130, 30, '#ff3b3b');
        }
        break;
      }
      case 'block': {
        const away = state.fighters[e.by].x <= e.x ? 1 : -1;
        this.spawn(x, y, away * 20, 0, 12, 30, '#59c8ff', 'shield');
        this.spawn(x, y, 0, 0, 7, 56, '#59c8ff', 'glow');
        this.spawn(x, y, 0, 0, 8, 6, '#bfeaff', 'shock', 26);
        const m = this.lowFx ? 3 : 6;
        for (let i = 0; i < m; i++) {
          const h1 = hash01(state.frame * 13 + i);
          this.spawn(x, y + (i - m / 2) * 6, away * (120 + h1 * 160), (h1 - 0.5) * 140, 9, 4, i & 1 ? '#bfeaff' : '#59c8ff', 'chevron');
        }
        break;
      }
      case 'parry':
        this.spawn(x, y, 0, 0, 20, 40, '#3ddc97', 'ring');
        this.spawn(x, y, 0, 0, 14, 10, '#3ddc97', 'shock', 70);
        this.parryLeft = 6; // ~0.1 s
        this.banner('PARRY', x, y + 70, 30, '#3ddc97');
        break;
      case 'super':
        this.superLeft = SUPER_FREEZE_FRAMES; this.superBy = e.by; this.superName = this.nameOf(e.by);
        this.superFlash = 8; this.superX = x; this.superY = y + 60;
        break;
      case 'ko': {
        this.koFlashes = 18; this.koLeft = 90;
        this.koLoser = state.fighters[0].hp <= 0 ? 0 : 1;
        this.hitFlash[this.koLoser] = 2;
        this.spawn(x, y, 0, 0, 24, 20, '#ffffff', 'shock', 190);
        this.spawn(x, y, 0, 0, 34, 10, '#ffd84a', 'shock', 120);
        this.crackLeft = 30; this.crackX = x; this.crackY = y;
        this.koBannerDue = true; // "K.O." text appears once the crack has played
        break;
      }
      case 'land': this.dust(x, y - 60, 6); break;
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
    // K.O. slow-motion look: particles advance at half speed (the sim itself is never slowed).
    const slow = this.koLeft > 0 && (this.tick & 1) === 1;
    if (!slow) {
      for (const p of this.pool) {
        if (!p.alive) continue;
        p.x += p.vx * DT; p.y += p.vy * DT;
        if (p.kind === 'debris') p.vy -= 900 * DT;
        if (--p.life <= 0) p.alive = false;
      }
    }
    for (const b of this.banners) if (b.life > 0) b.life--;
    if (this.flash > 0) this.flash--;
    if (this.koFlashes > 0) {
      this.koFlashes--;
      this.hitFlash[this.koLoser] = this.koFlashes % 6 >= 3 ? 1 : 0; // 3 white pulses on the loser
    }
    if (this.koFlashes === 0) { if (this.hitFlash[0] > 0) this.hitFlash[0]--; if (this.hitFlash[1] > 0) this.hitFlash[1]--; }
    if (this.superLeft > 0) this.superLeft--;
    if (this.superFlash > 0) this.superFlash--;
    if (this.parryLeft > 0) this.parryLeft--;
    if (this.crackLeft > 0) this.crackLeft--;
    if (this.koLeft > 0) {
      if (this.koBannerDue && this.koLeft <= 60) { this.koBannerDue = false; this.banner('K.O.', 0, 0, 60, '#ffffff', 3); }
      this.koLeft--;
    }
    this.tick++;
  }

  /** Background desaturation after a parry; call after the stage, before the fighters. */
  drawDesat(ctx: CanvasRenderingContext2D): void {
    if (this.parryLeft <= 0) return;
    ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = Math.min(1, this.parryLeft / 3);
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 640, 360);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  /** Super dim layer; the scene draws the attacker after this call. */
  drawDim(ctx: CanvasRenderingContext2D): void {
    if (this.superLeft <= 0) return;
    ctx.fillStyle = 'rgba(8,4,20,0.62)'; ctx.fillRect(0, 0, 640, 360);
    // Radial speed lines rotating around the attacker, accent coloured.
    const cx = 320, cy = 200;
    ctx.strokeStyle = this.accentOf(this.superBy); ctx.lineCap = 'butt';
    const rot = this.tick * 0.025, n = this.lowFx ? 10 : 18;
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      ctx.globalAlpha = 0.16 + (i % 3) * 0.09; ctx.lineWidth = 2 + (i % 3) * 2.5;
      ctx.beginPath(); ctx.moveTo(cx + c * 90, cy + s * 90); ctx.lineTo(cx + c * 520, cy + s * 520); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Bloom behind the attacker during the super freeze (cached glow sprite). `sx/sy` map world px to screen. */
  drawBloom(ctx: CanvasRenderingContext2D, sx: (x: number) => number, sy: (y: number) => number): void {
    if (this.superLeft <= 0) return;
    const pulse = 0.75 + 0.25 * Math.sin(this.tick * 0.4);
    drawGlow(ctx, sx(this.superX), sy(this.superY), 110 * pulse, this.accentOf(this.superBy), 0.8);
    drawGlow(ctx, sx(this.superX), sy(this.superY), 55, '#ffffff', 0.55);
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
        ctx.lineWidth = 4; ctx.beginPath();
        for (let i = 0; i <= 4; i++) { const a = (-60 + i * 30) * Math.PI / 180; const px = x + Math.cos(a) * r * d, py = y + Math.sin(a) * r * 1.3; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.stroke(); ctx.globalAlpha *= 0.55; ctx.lineTo(x, y); ctx.closePath(); ctx.fill(); ctx.lineWidth = 2;
      } else if (p.kind === 'sparkle') {
        const r = p.r * k;
        ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.3, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.3, y); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x, y + r * 0.3); ctx.lineTo(x + r, y); ctx.lineTo(x, y - r * 0.3); ctx.closePath(); ctx.fill();
      } else if (p.kind === 'puff') {
        ctx.globalAlpha = Math.max(0, k * 0.7);
        ctx.beginPath(); ctx.arc(x, y, p.r * (1.6 - k * 0.6), 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'glow') {
        drawGlow(ctx, x, y, p.r, p.color, ctx.globalAlpha);
        ctx.globalAlpha = 1;
      } else if (p.kind === 'debris') {
        ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.6));
        ctx.fillRect(x - p.r, y - p.r, p.r * 2, p.r * 2);
      } else if (p.kind === 'shock') {
        // Expanding shockwave: radius r -> r1, thick edge thinning out.
        const rr = p.r + (p.r1 - p.r) * (1 - k * k);
        ctx.lineWidth = 1 + 5 * k; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 2;
      } else if (p.kind === 'streak') {
        // Thin tapering line trailing behind the motion direction.
        const d = p.vx >= 0 ? 1 : -1, len = p.r * (0.5 + k);
        ctx.lineWidth = 1 + 2 * k; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - d * len, y); ctx.lineTo(x + d * len * 0.2, y); ctx.stroke(); ctx.lineWidth = 2;
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
    if (this.crackLeft > 0) this.drawCrack(ctx);
    if (this.superFlash > 0) {
      ctx.globalAlpha = (this.superFlash / 8) * 0.55; ctx.fillStyle = this.accentOf(this.superBy); ctx.fillRect(0, 0, 640, 360); ctx.globalAlpha = 1;
    }
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

  /** Screen-crack lines fanning out from the impact point; the sprite is pre-rendered once. */
  private drawCrack(ctx: CanvasRenderingContext2D): void {
    const c = crackSprite();
    if (!c) return;
    const k = this.crackLeft / 30, grow = Math.min(1, (1 - k) * 5 + 0.3);
    const w = 640 * grow, h = 360 * grow;
    ctx.globalAlpha = Math.min(1, k * 2);
    ctx.drawImage(c, 320 - w / 2, 180 - h / 2, w, h);
    ctx.globalAlpha = 1;
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

let crack: HTMLCanvasElement | null = null;
/** Pre-rendered crack web (deterministic jagged rays from the centre + two ring fractures). */
function crackSprite(): HTMLCanvasElement | null {
  if (crack || typeof document === 'undefined') return crack;
  const c = document.createElement('canvas'); c.width = 640; c.height = 360;
  const g = c.getContext('2d');
  if (!g) return null;
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [w, col] of [[5, 'rgba(20,10,30,0.55)'], [2, 'rgba(255,255,255,0.9)']] as const) {
    g.lineWidth = w; g.strokeStyle = col; g.beginPath();
    for (let i = 0; i < 11; i++) {
      let a = (i / 11) * Math.PI * 2 + hash01(i) * 0.4, x = 320, y = 180;
      g.moveTo(x, y);
      for (let j = 0; j < 7; j++) {
        a += (hash01(i * 9 + j) - 0.5) * 0.7; const step = 30 + hash01(i * 5 + j * 3) * 45;
        x += Math.cos(a) * step; y += Math.sin(a) * step * 0.8; g.lineTo(x, y);
      }
    }
    for (const r of [70, 140]) {
      for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 2, rr = r * (0.85 + hash01(i + r) * 0.3); const px = 320 + Math.cos(a) * rr, py = 180 + Math.sin(a) * rr * 0.8; i ? g.lineTo(px, py) : g.moveTo(px, py); }
    }
    g.stroke();
  }
  crack = c;
  return crack;
}
