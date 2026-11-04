import { randomBytes } from "node:crypto";
import { createMatch, cloneState, step, checksum, createCpu, cpuInput, type MatchState, type CpuState, type CpuDifficulty } from "@kb/shared";
import { FixedClock } from "../sim/FixedClock.js";
import { Room, type Client } from "colyseus";
import {
  CONTENT_HASH, FIGHT_ROOM_NAME, JoinOptionsSchema, MAX_CLIENTS, MSG, PROTOCOL_VERSION, parseClientMsg,
  type LobbyMsg, type LobbySlot, type CharId, type ServerMsg, ServerMsgSchema,
} from "@kb/shared/net/protocol";
import type { AuthServices } from "../auth/Services.js";
import { originOk } from "../http/securityHeaders.js";
import { InvalidMessageGuard } from "../net/InvalidMessageGuard.js";
import { TokenBucket } from "../net/RateLimits.js";
import { log } from "../ops/StructuredLog.js";
import { roomDirectory } from "./RoomDirectory.js";

export const AUTH_REVOKED_CLOSE = 4401;
export const INVALID_CLOSE = 4400;

let authServices: AuthServices | null = null;
const liveRooms = new Set<FightRoom>();
export function liveFightRooms(): ReadonlySet<FightRoom> { return liveRooms; }
export function setFightAuth(a: AuthServices | null): void { authServices = a; }

interface Seat {
  authId: string; // internal; never sent or logged
  name: string;
  slot: 0 | 1;
  inBucket: TokenBucket;
  otherBucket: TokenBucket;
  invalid: InvalidMessageGuard;
  char: CharId | null; ready: boolean; connected: boolean; rematch: boolean; snapAt: number;
}

/** Server-owned CPU seat (spec §11.3). Its CpuState lives outside MatchState. */
interface BotSeat { slot: 0 | 1; char: CharId; difficulty: CpuDifficulty; cpu: CpuState | null }

export class FightRoom extends Room {
  override maxClients: number = MAX_CLIENTS;
  roomCode = "";
  private seats = new Map<string, Seat>();
  private seatByAuth = new Map<string, string>();
  private bot: BotSeat | null = null;

  private match: MatchState | null = null;
  private startAt = 0;
  private seed = 1;
  private ended = false;
  private pendingInputs = new Map<number, [number | null, number | null]>();
  private previous: [number, number] = [0, 0];
  private hashes = new Map<number, number>();
  private fixed = new FixedClock();
  private handlers: (() => void)[] = [];
  private reservations = new Map<string, { reject: () => void }>();

  override onCreate(options: { roomCode?: string }): void {
    this.roomCode = typeof options?.roomCode === "string" ? options.roomCode : "";
    if (this.roomCode === "") throw new Error("ROOM_CODE_REQUIRED");
    roomDirectory.register(this.roomCode, this.roomId);
    liveRooms.add(this);
    this.setSimulationInterval((dt) => this.fixed.advance(dt, () => this.confirmInputs()), 1);
    this.handlers.push(this.onMessage(MSG, (client, raw) => this.onClientMessage(client, raw)));
    // No arbitrary client events: everything else is dropped and counted.
    this.handlers.push(this.onMessage("*", (client) => { this.noteInvalid(client, "unknown_type"); }));
  }

  override async onAuth(_client: Client, options: unknown, context?: { headers?: Headers }): Promise<{ authId: string; displayName: string }> {
    const auth = authServices;
    if (!auth) throw new Error("AUTH_FAILED");
    // A present foreign Origin is refused; a missing Origin (non-browser) still needs a one-use ticket.
    if (originOk(context?.headers?.get("origin"), auth.config.allowedOrigins) === "foreign") {
      log("warn", "websocket origin refused", { room: this.roomId });
      throw new Error("AUTH_FAILED");
    }
    const parsed = JoinOptionsSchema.safeParse(options);
    if (!parsed.success) throw new Error("AUTH_FAILED");
    const o = parsed.data;
    // Consume first: a failed comparison also burns the ticket.
    const hit = auth.tickets.consume(o.ticket, { roomName: this.roomName, roomCode: o.roomCode, contentHash: o.contentHash, protocolVersion: o.protocolVersion });
    if (!hit || o.contentHash !== CONTENT_HASH || o.protocolVersion !== PROTOCOL_VERSION || o.roomCode !== this.roomCode) throw new Error("AUTH_FAILED");
    const session = auth.sessions.getById(hit.sessionId);
    if (!session) throw new Error("AUTH_FAILED");
    if (this.seatByAuth.has(session.id)) throw new Error("SEAT_TAKEN");
    if (this.seats.size + (this.bot ? 1 : 0) >= MAX_CLIENTS) throw new Error("SEAT_TAKEN");
    return { authId: session.id, displayName: session.displayName };
  }

  override onJoin(client: Client, _options: unknown, auth: { authId: string; displayName: string }): void {
    const taken = new Set([...this.seats.values()].map((s) => s.slot));
    if (this.bot) taken.add(this.bot.slot);
    const slot: 0 | 1 = taken.has(0) ? 1 : 0;
    const now = Date.now();
    this.seats.set(client.sessionId, {
      authId: auth.authId, name: auth.displayName, slot,
      // Spec §11.2: `in` ≤ 90/s with bursts of 20; other kinds ≤ 5/s.
      inBucket: new TokenBucket(90, 20, now), otherBucket: new TokenBucket(5, 5, now), invalid: new InvalidMessageGuard(),
      char: null, ready: false, connected: true, rematch: false, snapAt: -Infinity,
    });
    this.seatByAuth.set(auth.authId, client.sessionId);
    log("info", "player joined", { room: this.roomId, slot });
    this.broadcastLobby();
  }

  override async onDrop(client: Client): Promise<void> {
    const seat = this.seats.get(client.sessionId);
    if (!seat) return;
    seat.connected = false;
    this.previous[seat.slot] = 0;
    for (const pair of this.pendingInputs.values()) pair[seat.slot] = null;
    if (!authServices?.sessions.getById(seat.authId)) return;
    const reservation = this.allowReconnection(client, 20);
    this.reservations.set(client.sessionId, { reject: () => reservation.reject() });
    try { await reservation; } catch { /* Colyseus invokes onLeave after expiry. */ }
    finally { this.reservations.delete(client.sessionId); }
  }

  override onReconnect(client: Client): void {
    const seat = this.seats.get(client.sessionId);
    if (!seat) return;
    if (!authServices?.sessions.getById(seat.authId)) { client.leave(AUTH_REVOKED_CLOSE); return; }
    seat.connected = true;
    this.sendStart(client, seat);
    this.sendSnap(client, seat, true);
    if (this.ended && this.match) this.sendGame(client, { t: "end", winner: this.match.winner });
    this.broadcastLobby();
  }

  override onLeave(client: Client): void {
    const seat = this.seats.get(client.sessionId);
    if (!seat) return;
    if (this.match && !this.ended) {
      this.match.phase = "matchEnd";
      this.match.winner = seat.slot === 0 ? 1 : 0;
      this.ended = true;
      this.emit({ t: "end", winner: this.match.winner });
    }
    this.seatByAuth.delete(seat.authId);
    this.seats.delete(client.sessionId);
    if (this.seats.size === 0) {
      this.match = null;
      this.ended = false;
      this.pendingInputs.clear();
      this.hashes.clear();
      this.previous = [0, 0];
      this.bot = null;
    }
    log("info", "player left", { room: this.roomId, slot: seat.slot });
    this.broadcastLobby();
  }

  override onDispose(): void {
    this.setSimulationInterval();
    for (const off of this.handlers) off();
    this.handlers = [];
    for (const reservation of this.reservations.values()) reservation.reject();
    this.reservations.clear();
    this.pendingInputs.clear();
    this.hashes.clear();
    liveRooms.delete(this);
    roomDirectory.unregister(this.roomId);
    this.seats.clear();
    this.seatByAuth.clear();
    this.bot = null;
  }

  /** Auth ids and connection state, including reserved seats. */
  seatedSessions(): { authId: string; connected: boolean }[] {
    return [...this.seats.values()].map((s) => ({ authId: s.authId, connected: s.connected }));
  }

  /** Ends the seat bound to an auth session with close code 4401. Other seats are untouched. */
  revokeAuthSession(authId: string): void {
    const sid = this.seatByAuth.get(authId);
    if (sid === undefined) return;
    this.reservations.get(sid)?.reject();
    this.clients.find((c) => c.sessionId === sid)?.leave(AUTH_REVOKED_CLOSE);
  }

  lobby(): LobbyMsg {
    const slots: (LobbySlot & { slot: number })[] = [...this.seats.values()]
      .map((s) => ({ slot: s.slot, name: s.name, char: s.char, ready: s.ready, bot: false }));
    if (this.bot) slots.push({ slot: this.bot.slot, name: "CPU", char: this.bot.char, ready: true, bot: true });
    slots.sort((a, b) => a.slot - b.slot);
    return { t: "lobby", slots: slots.map(({ slot: _slot, ...rest }) => rest) };
  }

  private seatCount(): number { return this.seats.size + (this.bot ? 1 : 0); }

  /** Lone human before a match: fill the empty slot with a CPU (or change its char/difficulty). */
  private setBot(char: CharId, difficulty: CpuDifficulty): void {
    if (this.match || this.seats.size !== 1) return;
    const human = [...this.seats.values()][0]!;
    this.bot = { slot: human.slot === 0 ? 1 : 0, char, difficulty, cpu: null };
    // onAuth refuses a second human while the CPU holds the slot.
    this.broadcastLobby();
    this.maybeStart();
  }

  private broadcastLobby(): void { this.emit(this.lobby()); }

  private onClientMessage(client: Client, raw: unknown): void {
    const seat = this.seats.get(client.sessionId);
    if (!seat) return;
    const msg = parseClientMsg(raw);
    if (!msg) { this.noteInvalid(client, "schema"); return; }
    const now = Date.now();
    const bucket = msg.t === "in" ? seat.inBucket : seat.otherBucket;
    if (!bucket.take(now)) { this.noteInvalid(client, "rate"); return; }
    switch (msg.t) {
      case "pick":
        if (!this.match) { seat.char = msg.char; seat.ready = false; this.broadcastLobby(); }
        break;
      case "ready":
        if (!this.match && seat.char) { seat.ready = true; this.broadcastLobby(); this.maybeStart(); }
        break;
      case "in":
        if (this.match && !this.ended && seat.connected && msg.f > this.match.frame && msg.f <= this.match.frame + 600) {
          const pair = this.pendingInputs.get(msg.f) ?? [null, null];
          if (pair[seat.slot] === null) pair[seat.slot] = msg.b;
          this.pendingInputs.set(msg.f, pair);
        }
        break;
      case "ack":
        if (this.hashes.has(msg.f) && this.hashes.get(msg.f) !== msg.h) this.sendSnap(client, seat);
        break;
      case "resync": this.sendSnap(client, seat); break;
      case "bot": this.setBot(msg.char, msg.difficulty); break;
      case "rematch":
        if (this.ended) {
          seat.rematch = true;
          if (this.seatCount() === 2 && [...this.seats.values()].every((s) => s.rematch && s.connected)) this.startMatch();
        }
        break;
    }
  }

  private sendGame(client: Client, msg: ServerMsg): void { client.send(MSG, ServerMsgSchema.parse(msg)); }
  private emit(msg: ServerMsg): void { this.broadcast(MSG, ServerMsgSchema.parse(msg)); }

  private maybeStart(): void {
    if (this.seatCount() === 2 && [...this.seats.values()].every((s) => s.char && s.ready && s.connected)) this.startMatch();
  }

  private startMatch(): void {
    const ordered = [...this.seats.values()].sort((a, b) => a.slot - b.slot);
    const charAt = (slot: 0 | 1): CharId => this.bot?.slot === slot ? this.bot.char : ordered.find((s) => s.slot === slot)!.char!;
    const chars: [CharId, CharId] = [charAt(0), charAt(1)];
    let seed = 0;
    while (seed === 0) seed = randomBytes(4).readUInt32LE();
    const stage = chars[0] === "chompa" ? "volcano" : chars[0] === "kaze" || chars[0] === "bao" ? "bamboo" : "rooftop";
    this.seed = seed;
    this.match = createMatch({ chars, stage, seed });
    if (this.bot) this.bot.cpu = createCpu({ side: this.bot.slot, difficulty: this.bot.difficulty, matchSeed: seed });
    this.startAt = Date.now() + 1500;
    this.ended = false;
    this.pendingInputs.clear(); this.hashes.clear(); this.previous = [0, 0];
    for (const s of ordered) { s.rematch = false; s.snapAt = -Infinity; }
    for (const client of this.clients) this.sendStart(client, this.seats.get(client.sessionId)!);
  }

  private sendStart(client: Client, seat: Seat): void {
    if (!this.match) return;
    // The seed is retained separately because MatchState.rng may advance during play.
    this.sendGame(client, { t: "start", seed: this.seed, chars: [this.match.fighters[0].char, this.match.fighters[1].char],
      stage: this.match.stage, you: seat.slot, startAtMs: this.startAt, delay: 2 });
  }

  private sendSnap(client: Client, seat: Seat, reconnect = false): void {
    const now = Date.now();
    if (!this.match || (!reconnect && now - seat.snapAt < 2000)) return;
    seat.snapAt = now;
    this.sendGame(client, { t: "snap", f: this.match.frame, state: cloneState(this.match) });
  }

  private confirmInputs(): void {
    const state = this.match, now = Date.now();
    if (!state || this.ended || now < this.startAt) return;
    const first = state.frame + 1;
    const batch: [number, number][] = [];
    const hashes: ServerMsg[] = [];
    while (batch.length < 600) {
      const f = state.frame + 1;
      const pair = this.pendingInputs.get(f) ?? [null, null];
      for (const seat of this.seats.values()) if (!seat.connected) pair[seat.slot] = 0;
      const bot = this.bot;
      const botReady = (i: 0 | 1): boolean => bot?.slot === i && bot.cpu !== null;
      if (((pair[0] === null && !botReady(0)) || (pair[1] === null && !botReady(1))) && now < this.startAt + f * 1000 / 60 + 100) break;
      // Exactly once per confirmed frame, on the pre-step state.
      if (bot?.cpu) pair[bot.slot] = cpuInput(bot.cpu, state);
      const confirmed: [number, number] = [pair[0] ?? this.previous[0], pair[1] ?? this.previous[1]];
      this.pendingInputs.delete(f); this.previous = confirmed;
      step(state, confirmed); batch.push(confirmed);
      if (f % 60 === 0) {
        const h = checksum(state); this.hashes.set(f, h);
        if (this.hashes.size > 4) this.hashes.delete(this.hashes.keys().next().value!);
        hashes.push({ t: "hash", f, h });
      }
      if (state.phase === "matchEnd") { this.ended = true; break; }
    }
    if (batch.length) this.emit({ t: "cf", f: first, b: batch });
    for (const hash of hashes) this.emit(hash);
    if (this.ended) this.emit({ t: "end", winner: state.winner });
  }

  private noteInvalid(client: Client, kind: string): void {
    const seat = this.seats.get(client.sessionId);
    if (!seat) return;
    log("warn", "invalid message", { room: this.roomId, kind });
    if (seat.invalid.record(Date.now())) client.leave(INVALID_CLOSE);
  }
}

export { FIGHT_ROOM_NAME };
