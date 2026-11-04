import { Room, type Client } from "colyseus";
import {
  CONTENT_HASH, FIGHT_ROOM_NAME, JoinOptionsSchema, MAX_CLIENTS, MSG, PROTOCOL_VERSION, parseClientMsg,
  type LobbyMsg, type LobbySlot,
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
}

/**
 * S12a placeholder: two seats, join/leave and the `lobby` broadcast only.
 * TODO(S12b): pick/ready/start, input confirmation, FixedClock tick, hashes, snapshots, reconnection and forfeit (spec §11.3).
 */
export class FightRoom extends Room {
  override maxClients: number = MAX_CLIENTS;
  roomCode = "";
  private seats = new Map<string, Seat>();
  private seatByAuth = new Map<string, string>();

  override onCreate(options: { roomCode?: string }): void {
    this.roomCode = typeof options?.roomCode === "string" ? options.roomCode : "";
    if (this.roomCode === "") throw new Error("ROOM_CODE_REQUIRED");
    roomDirectory.register(this.roomCode, this.roomId);
    liveRooms.add(this);
    this.onMessage(MSG, (client, raw) => this.onClientMessage(client, raw));
    // No arbitrary client events: everything else is dropped and counted.
    this.onMessage("*", (client) => { this.noteInvalid(client, "unknown_type"); });
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
    return { authId: session.id, displayName: session.displayName };
  }

  override onJoin(client: Client, _options: unknown, auth: { authId: string; displayName: string }): void {
    const taken = new Set([...this.seats.values()].map((s) => s.slot));
    const slot: 0 | 1 = taken.has(0) ? 1 : 0;
    const now = Date.now();
    this.seats.set(client.sessionId, {
      authId: auth.authId, name: auth.displayName, slot,
      // Spec §11.2: `in` ≤ 90/s with bursts of 20; other kinds ≤ 5/s.
      inBucket: new TokenBucket(90, 20, now), otherBucket: new TokenBucket(5, 5, now), invalid: new InvalidMessageGuard(),
    });
    this.seatByAuth.set(auth.authId, client.sessionId);
    log("info", "player joined", { room: this.roomId, slot });
    this.broadcastLobby();
  }

  override onLeave(client: Client): void {
    const seat = this.seats.get(client.sessionId);
    if (!seat) return;
    this.seatByAuth.delete(seat.authId);
    this.seats.delete(client.sessionId);
    log("info", "player left", { room: this.roomId, slot: seat.slot });
    this.broadcastLobby();
  }

  override onDispose(): void {
    liveRooms.delete(this);
    roomDirectory.unregister(this.roomId);
    this.seats.clear();
    this.seatByAuth.clear();
  }

  /** Auth ids of seated players (all connected: reconnection holds arrive in S12b). */
  seatedSessions(): { authId: string; connected: boolean }[] {
    return [...this.seats.values()].map((s) => ({ authId: s.authId, connected: true }));
  }

  /** Ends the seat bound to an auth session with close code 4401. Other seats are untouched. */
  revokeAuthSession(authId: string): void {
    const sid = this.seatByAuth.get(authId);
    if (sid === undefined) return;
    this.clients.find((c) => c.sessionId === sid)?.leave(AUTH_REVOKED_CLOSE);
  }

  lobby(): LobbyMsg {
    const slots: LobbySlot[] = [...this.seats.values()]
      .sort((a, b) => a.slot - b.slot)
      .map((s) => ({ name: s.name, char: null, ready: false, bot: false }));
    return { t: "lobby", slots };
  }

  private broadcastLobby(): void { this.broadcast(MSG, this.lobby()); }

  private onClientMessage(client: Client, raw: unknown): void {
    const seat = this.seats.get(client.sessionId);
    if (!seat) return;
    const msg = parseClientMsg(raw);
    if (!msg) { this.noteInvalid(client, "schema"); return; }
    const now = Date.now();
    const bucket = msg.t === "in" ? seat.inBucket : seat.otherBucket;
    if (!bucket.take(now)) { this.noteInvalid(client, "rate"); return; }
    // TODO(S12b): handle pick/ready/in/ack/resync/rematch. The placeholder accepts and ignores valid messages.
  }

  private noteInvalid(client: Client, kind: string): void {
    const seat = this.seats.get(client.sessionId);
    if (!seat) return;
    log("warn", "invalid message", { room: this.roomId, kind });
    if (seat.invalid.record(Date.now())) client.leave(INVALID_CLOSE);
  }
}

export { FIGHT_ROOM_NAME };
