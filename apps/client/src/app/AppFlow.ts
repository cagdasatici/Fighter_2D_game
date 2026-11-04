import { CHARS, METER_MAX, PX, cloneState, createCpu, createMatch, cpuInput, getMove, step, type CharId, type CpuState, type Fighter, type InputByte, type MatchState, type StageId } from '@kb/shared';
import { Keyboard } from '../input/Keyboard.js';
import { Canvas, GROUND, HEIGHT, WIDTH } from '../render/Canvas.js';
import { Camera } from '../render/Camera.js';
import { drawDebug } from '../render/DebugDraw.js';
import { Fx } from '../render/Fx.js';
import { Hud } from '../render/Hud.js';
import { SKINS } from '../render/Gallery.js';
import { drawPuppet } from '../render/Puppet.js';
import { drawStage } from '../render/Stage.js';
import { clipFor, poseOf } from '../render/clips.js';
import { GameLoop } from './GameLoop.js';
import { AudioBus, type AudioContextLike } from '../audio/AudioBus.js';
import { cuesForFrame } from '../audio/sfx.js';
import { AdvantageMeter, advantageText, applyTrainingRefills, dummyInput, type TrainingOptions } from './Training.js';
import { showCharSelect } from '../ui/CharSelect.js';
import { showHowToPlay } from '../ui/HowToPlay.js';
import { showPause } from '../ui/Pause.js';
import { drawResults, showResults } from '../ui/Results.js';
import { loadSettings, showSettings, type Settings } from '../ui/Settings.js';
import { showTitle } from '../ui/Title.js';
import { VS_FRAMES, drawVs, showVs } from '../ui/VsScreen.js';
import { showOnlineLobby, showRoomPanel, type RoomPanel } from '../ui/Lobby.js';
import { ClientError, RoomClient } from '../net/RoomClient.js';
import { ClockSync } from '../net/ClockSync.js';
import { Rollback } from '../net/Rollback.js';
import type { ServerMsg } from '@kb/shared/net/protocol';
import '../ui/experience.css';

declare global {
  interface Window { __kb?: { readonly state: MatchState; step: (inputs?: [InputByte, InputByte]) => void; start: (mode: Mode, chars?: [CharId, CharId]) => void } }
}

export type Mode = 'cpu' | 'local' | 'training';
type Scene = 'menu' | 'vs' | 'fight' | 'results';

/** Spec §15 screen flow + §11.5 local modes. One GameLoop drives every scene; menus are DOM overlays. */
export class AppFlow {
  state: MatchState = createMatch({ chars: ['bolt', 'volt'], stage: 'rooftop', seed: 1 });
  private previous = cloneState(this.state);
  private readonly settings: Settings = loadSettings();
  private readonly canvas: Canvas;
  private readonly camera = new Camera();
  private readonly keyboard: Keyboard;
  private readonly loop: GameLoop;
  private readonly ui: HTMLElement;
  private closeUi: (() => void) | null = null;
  private scene: Scene = 'menu';
  private sceneFrame = 0;
  private mode: Mode = 'cpu';
  private paused = false;
  private chars: [CharId, CharId] = ['bolt', 'volt'];
  private stage: StageId = 'rooftop';
  private cpu: CpuState | null = null;
  private seedCounter = 1;
  /** Online session (S13): room client, clock and rollback driver. Null offline. */
  private net: { client: RoomClient; clock: ClockSync; rb: Rollback | null; panel: RoomPanel | null; offs: (() => void)[]; ping: number | null } | null = null;
  private readonly training: TrainingOptions = { dummy: 'stand', infiniteHp: true, infiniteMeter: false };
  private readonly advantage = new AdvantageMeter();
  private boxes: boolean;
  private fx = this.newFx();
  private hud = new Hud(this.state);
  private renderTick = 0;
  private readonly audio = new AudioBus(() => new AudioContext() as unknown as AudioContextLike);
  private readonly unlockAudio = (): void => {
    this.audio.unlock();
    if (this.audio.ensureRunning()) this.removeGestureListeners();
  };
  private readonly onVisibility = (): void => { if (document.hidden) this.audio.suspend(); else this.audio.resume(); };
  constructor(element: HTMLCanvasElement) {
    this.canvas = new Canvas(element);
    this.boxes = import.meta.env.DEV && this.settings.debugBoxes;
    this.ui = document.createElement('div');
    this.ui.className = 'kb-ui';
    document.body.append(this.ui);
    this.keyboard = new Keyboard(this.settings.keys, () => { this.boxes = !this.boxes; }, () => this.togglePause());
    this.applySettings();
    this.loop = new GameLoop(() => this.tick(), alpha => this.render(alpha));
    window.addEventListener('pointerdown', this.unlockAudio);
    window.addEventListener('keydown', this.unlockAudio);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (import.meta.env.DEV) {
      const app = this;
      window.__kb = {
        get state() { return app.state; },
        step: (inputs = [0, 0]) => this.advance(inputs),
        start: (mode, chars = ['bolt', 'volt']) => { this.mode = mode; this.chars = chars; this.startMatch(); this.enterFight(); },
      };
    }
    this.toTitle();
    this.loop.start();
  }

  private newFx(): Fx { return new Fx(by => CHARS[this.state.fighters[by].char].name, by => SKINS[this.state.fighters[by].char].accent); }
  private applySettings(): void {
    const s = this.settings;
    this.audio.setEffectsVolume(s.effectsVolume); this.audio.setMusicVolume(s.musicVolume); this.audio.setMusicEnabled(s.musicOn);
    this.keyboard.setKeys(s.keys);
    if (import.meta.env.DEV) this.boxes = s.debugBoxes;
  }
  private show(open: (root: HTMLElement) => () => void): void { this.closeUi?.(); this.closeUi = open(this.ui); }
  private hideUi(): void { this.closeUi?.(); this.closeUi = null; }

  // ---- scenes ----
  private toTitle(): void {
    this.scene = 'menu'; this.paused = false; this.audio.setStage(null);
    this.show(root => showTitle(root, c => {
      if (c === 'settings') this.show(r => showSettings(r, this.settings, () => this.applySettings(), () => this.toTitle()));
      else if (c === 'howto') this.show(r => showHowToPlay(r, this.settings.keys[0], () => this.toTitle()));
      else if (c === 'online') this.toOnline();
      else if (c === 'cpu' || c === 'local' || c === 'training') { this.mode = c; this.toSelect(); }
    }));
  }
  private toSelect(): void {
    this.scene = 'menu'; this.paused = false; this.audio.setStage(null);
    this.show(root => showCharSelect(root, {
      twoHumans: this.mode === 'local', keys: this.settings.keys, initial: this.chars,
      done: r => { this.chars = r.chars; this.stage = r.stage; this.startMatch(); this.toVs(); },
      back: () => this.toTitle(),
    }));
  }
  private toVs(): void {
    this.scene = 'vs'; this.sceneFrame = 0;
    this.show(root => showVs(root, this.chars));
  }
  private enterFight(): void { this.scene = 'fight'; this.paused = false; this.sceneFrame = 0; this.hideUi(); this.keyboard.setKeys(this.settings.keys); }
  private toResults(): void {
    this.scene = 'results'; this.sceneFrame = 0; this.audio.setStage(null);
    this.show(root => showResults(root, this.state, this.mode === 'cpu' ? 1 : null, c => {
      if (c === 'rematch') { this.startMatch(); this.toVs(); } else if (c === 'select') this.toSelect(); else this.toTitle();
    }));
  }
  // ---- online (spec §11.4, §15) ----
  private onlineClient(): NonNullable<AppFlow['net']> {
    if (this.net) return this.net;
    const ws = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
    const client = new RoomClient({ httpBase: '', wsEndpoint: ws });
    this.net = { client, clock: new ClockSync(), rb: null, panel: null, offs: [], ping: null };
    return this.net;
  }
  private toOnline(): void {
    this.scene = 'menu'; this.audio.setStage(null);
    const net = this.onlineClient();
    this.show(root => showOnlineLobby(root, {
      list: () => net.client.listRooms(),
      join: async code => { await net.client.join(code); this.toRoom(); },
      login: (invite, name) => net.client.login(invite, name),
      openLogin: name => net.client.openLogin(name),
      back: () => { this.leaveOnline(); this.toTitle(); },
    }));
  }
  private toRoom(): void {
    const net = this.net;
    if (!net) return;
    this.scene = 'menu';
    net.offs.push(net.client.onMessage(m => this.onServer(m)));
    net.offs.push(net.client.onClose(() => { if (this.net === net) { this.leaveOnline(); this.toTitle(); } }));
    // Clock pings once per second while seated (cleared in leaveOnline).
    const ping = (): void => {
      const n = net.clock.makePing(Date.now());
      net.client.serverTime().then(ms => { net.clock.onPong(n, ms, Date.now()); }, (e: unknown) => { if (!(e instanceof ClientError)) throw e; });
    };
    ping(); net.ping = window.setInterval(ping, 1000);
    this.showRoomPanel();
  }
  private showRoomPanel(): void {
    const net = this.net;
    if (!net) return;
    this.show(root => {
      net.panel = showRoomPanel(root, this.chars[0], {
        pick: c => { this.chars = [c, this.chars[1]]; net.client.send({ t: 'pick', char: c }); },
        ready: () => net.client.send({ t: 'ready' }),
        addCpu: c => net.client.send({ t: 'bot', char: c, difficulty: this.settings.difficulty }),
        leave: () => { this.leaveOnline(); this.toOnline(); },
      });
      return () => { net.panel?.close(); net.panel = null; };
    });
  }
  private onServer(m: ServerMsg): void {
    const net = this.net;
    if (!net) return;
    if (m.t === 'lobby') { net.panel?.update(m); return; }
    if (m.t === 'start') {
      net.rb = new Rollback(m, msg => net.client.send(msg));
      this.mode = 'cpu'; this.chars = m.chars; this.stage = m.stage;
      this.state = net.rb.current; this.previous = cloneState(this.state); this.cpu = null;
      this.fx = this.newFx(); this.hud = new Hud(this.state); this.camera.update(this.state);
      this.toVs();
      return;
    }
    net.rb?.onMessage(m);
  }
  private leaveOnline(): void {
    const net = this.net;
    if (!net) return;
    this.net = null;
    for (const off of net.offs) off();
    if (net.ping !== null) window.clearInterval(net.ping);
    net.client.dispose();
  }
  /** One online tick: rollback advance toward the server-clock target, then FX/SFX for newly shown frames only. */
  private tickOnline(rb: Rollback, clock: ClockSync): void {
    clock.frame();
    const before = this.state.frame;
    const prev = cloneState(this.state);
    rb.tick(clock.serverMs(Date.now()), clock.rttMs, () => this.keyboard.read()[0]);
    this.state = rb.current;
    if (this.state.frame !== before) this.previous = prev;
    const events = rb.takeEvents();
    if (events.length > 0 || this.state.frame !== before) {
      const shown: MatchState = { ...this.state, events };
      if (shown.frame !== this.fx.lastFxFrame) for (const c of cuesForFrame(prev, shown)) this.audio.play(c.kind, c.priority, 0);
      this.fx.consume(shown);
    }
    this.camera.update(this.state); this.fx.update(); this.hud.update(this.state);
    this.audio.setStage(this.state.phase === 'matchEnd' ? null : this.state.stage);
    if (rb.ended && ++this.sceneFrame >= 90) {
      this.state = { ...this.state, winner: rb.ended.winner };
      this.toResultsOnline();
    }
  }
  private toResultsOnline(): void {
    this.scene = 'results'; this.sceneFrame = 0; this.audio.setStage(null);
    this.show(root => showResults(root, this.state, null, c => {
      if (c === 'rematch') this.net?.client.send({ t: 'rematch' });
      else if (c === 'select') { this.leaveOnline(); this.toOnline(); }
      else { this.leaveOnline(); this.toTitle(); }
    }));
  }

  private togglePause(): void {
    if (this.scene !== 'fight' || this.net?.rb) return; // online has no pause
    if (this.paused) { this.paused = false; this.hideUi(); return; }
    this.paused = true;
    this.show(root => showPause(root, this.mode === 'training' ? this.training : null, c => {
      if (c === 'resume') { this.paused = false; this.hideUi(); }
      else if (c === 'restart') { this.startMatch(); this.enterFight(); }
      else if (c === 'select') this.toSelect(); else this.toTitle();
    }));
  }

  /** Fresh match + CPU memory. Seeds are a local counter (offline only; online seeds come from the server). */
  private startMatch(): void {
    const seed = this.seedCounter++;
    this.state = createMatch({ chars: this.chars, stage: this.stage, seed });
    this.previous = cloneState(this.state);
    this.cpu = this.mode === 'cpu' ? createCpu({ side: 1, difficulty: this.settings.difficulty, matchSeed: seed }) : null;
    this.fx = this.newFx(); this.hud = new Hud(this.state); this.camera.update(this.state);
    this.advantage.last = null;
  }

  private tick(): void {
    const rb = this.net?.rb;
    if (rb && this.net) {
      if (this.scene === 'vs' && ++this.sceneFrame >= VS_FRAMES) this.enterFight();
      if (this.scene === 'vs' || this.scene === 'fight') this.tickOnline(rb, this.net.clock);
      return;
    }
    if (this.scene === 'vs') { if (++this.sceneFrame >= VS_FRAMES) this.enterFight(); return; }
    if (this.scene !== 'fight') { this.sceneFrame++; return; }
    if (this.paused) return;
    const [p1, p2] = this.keyboard.read();
    const second = this.mode === 'local' ? p2 : this.mode === 'cpu' && this.cpu ? cpuInput(this.cpu, this.state) : dummyInput(this.state, this.training.dummy);
    this.advance([p1, second]);
    if (this.state.phase === 'matchEnd' && this.state.phaseFrame >= 90) this.toResults();
  }
  private advance(inputs: [InputByte, InputByte]): void {
    this.previous = cloneState(this.state);
    step(this.state, inputs);
    if (this.mode === 'training') { applyTrainingRefills(this.state, this.training); this.advantage.observe(this.state); }
    this.camera.update(this.state);
    // Exactly-once event consumption: Fx.lastFxFrame guards both FX and SFX (decision 0005).
    if (this.state.frame !== this.fx.lastFxFrame) for (const c of cuesForFrame(this.previous, this.state)) this.audio.play(c.kind, c.priority, 0);
    this.fx.consume(this.state); this.fx.update(); this.hud.update(this.state);
    this.audio.setStage(this.state.phase === 'matchEnd' ? null : this.state.stage);
  }

  private render(alpha: number): void {
    const ctx = this.canvas.begin();
    if (this.scene === 'vs') { drawVs(ctx, this.chars, this.stage, this.sceneFrame); return; }
    if (this.scene === 'results') { drawResults(ctx, this.state, this.renderTick++); return; }
    if (this.scene === 'menu') {
      drawStage(ctx, this.stage, { camX: 0, camY: 0, t: this.renderTick++ });
      ctx.fillStyle = 'rgba(10,10,30,0.6)'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      return;
    }
    if (this.boxes) drawDebug(ctx, this.state, this.previous, alpha, this.camera, true);
    else this.drawScene(ctx, alpha);
    if (this.mode === 'training') {
      ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#1b1b2a'; ctx.lineWidth = 3;
      const text = `ADV ${advantageText(this.advantage.last)}`;
      ctx.strokeText(text, 12, HEIGHT - 12); ctx.fillText(text, 12, HEIGHT - 12);
    }
    if (import.meta.env.DEV && this.net?.rb) {
      ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff';
      ctx.fillText(`RTT ${Math.round(this.net.clock.rttMs)} ms${this.net.rb.stalled ? ' STALL' : ''}`, WIDTH - 8, HEIGHT - 8);
    }
  }
  private removeGestureListeners(): void {
    window.removeEventListener('pointerdown', this.unlockAudio);
    window.removeEventListener('keydown', this.unlockAudio);
  }
  private drawScene(ctx: CanvasRenderingContext2D, alpha: number): void {
    const cam = this.camera, s = this.state;
    const sx = (x: number): number => 320 + x - cam.x + cam.shakeX;
    const sy = (y: number): number => GROUND - y + cam.y + cam.shakeY;
    drawStage(ctx, s.stage, { camX: cam.x - cam.shakeX, camY: cam.y + cam.shakeY, t: this.renderTick++ });
    const drawFighter = (i: 0 | 1): void => {
      const f: Fighter = s.fighters[i], old = this.previous.fighters[i];
      const x = (old.x + (f.x - old.x) * alpha) / PX, y = (old.y + (f.y - old.y) * alpha) / PX;
      const move = f.state === 'attack' && f.move ? getMove(f.char, f.move) ?? null : null;
      const flash = (f.state === 'hitstun' || f.state === 'juggle') && f.stateFrame <= 2 ? 'hit' as const : null;
      drawPuppet(ctx, SKINS[f.char], poseOf(clipFor(f, move)), sx(x), sy(y), f.facing,
        { frame: s.frame, meterFull: f.meter >= METER_MAX, glow: f.meter >= METER_MAX, flash });
    };
    const superBy = this.fx.superLeft > 0 ? this.fx.superBy : null;
    for (const i of [0, 1] as const) if (i !== superBy) drawFighter(i);
    for (const p of s.projectiles) {
      ctx.fillStyle = SKINS[s.fighters[p.owner].char].accent; ctx.strokeStyle = '#1b1b2a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(sx(p.x / PX), sy(p.y / PX), p.w / 2, p.h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    this.fx.drawDim(ctx);
    if (superBy !== null) drawFighter(superBy);
    this.fx.draw(ctx, sx, sy);
    this.hud.draw(ctx, s);
  }
  dispose(): void {
    this.leaveOnline();
    this.loop.dispose(); this.keyboard.dispose(); this.canvas.dispose();
    this.hideUi(); this.ui.remove();
    this.removeGestureListeners();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.audio.dispose();
    if (import.meta.env.DEV) delete window.__kb;
  }
}
