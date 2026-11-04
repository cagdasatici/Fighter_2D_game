import { Client, type Room } from '@colyseus/sdk';
import {
  CONTENT_HASH, ClientMsgSchema, MSG, PROTOCOL_VERSION, checkCompatibility, parseServerMsg,
  type ClientMsg, type JoinTicketResponse, type ServerMsg, type VersionResponse,
} from '@kb/shared/net/protocol';
import { RoomListResponseSchema, type RoomSummary } from '@kb/shared/net/rooms';
import { z } from 'zod';

/** Fight-room client (trimmed copy of battlegrounds RoomClient): session, room list, join ticket, validated messages. */
export type ClientErrorCode = 'SERVER_OFFLINE' | 'VERSION_MISMATCH' | 'INVITE_INVALID' | 'UNAUTHENTICATED' | 'ROOM_FULL';
export class ClientError extends Error {
  constructor(readonly code: ClientErrorCode) { super(code); }
}

export interface RoomClientDeps {
  /** http(s) base; empty string means same-origin relative URLs. */
  httpBase: string;
  /** ws(s) endpoint for Colyseus. */
  wsEndpoint: string;
  fetchFn?: typeof fetch;
}

const TimeResponseSchema = z.strictObject({ serverMs: z.number().finite() });

export class RoomClient {
  room: Room | null = null;
  /** Server messages that failed validation (dropped). */
  invalid = 0;
  private csrf: string | null = null;
  private readonly f: typeof fetch;
  private listeners = new Set<(m: ServerMsg) => void>();
  private closeListeners = new Set<() => void>();

  constructor(private readonly deps: RoomClientDeps) {
    this.f = deps.fetchFn ?? ((...a) => fetch(...a));
  }

  private async http(path: string, init: RequestInit = {}): Promise<Response> {
    try { return await this.f(this.deps.httpBase + path, { credentials: 'include', cache: 'no-store', ...init }); }
    catch { throw new ClientError('SERVER_OFFLINE'); }
  }
  private fail(r: Response): never {
    if (r.status === 401) throw new ClientError('UNAUTHENTICATED');
    if (r.status === 409) throw new ClientError('ROOM_FULL');
    if (r.status === 429 || r.status >= 500) throw new ClientError('SERVER_OFFLINE');
    throw new ClientError('INVITE_INVALID');
  }

  async checkVersion(): Promise<void> {
    const r = await this.http('/api/version');
    if (!r.ok) throw new ClientError('SERVER_OFFLINE');
    const v = (await r.json()) as VersionResponse;
    if (checkCompatibility(v, { protocolVersion: PROTOCOL_VERSION, contentHash: CONTENT_HASH }) !== 'ok') throw new ClientError('VERSION_MISMATCH');
  }

  /** Invitation login: exchanges an invite token for a session cookie. */
  async login(invite: string, displayName: string): Promise<void> {
    const r = await this.http('/api/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ invite, displayName }) });
    if (r.status !== 201) this.fail(r);
    this.csrf = null;
  }

  /** Open join (server OPEN_JOIN=1). Returns false when open join is off. */
  async openLogin(displayName: string): Promise<boolean> {
    const r = await this.http('/api/open-session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName }) });
    if (r.status === 404) return false;
    if (r.status !== 200 && r.status !== 201) this.fail(r);
    this.csrf = null;
    return true;
  }

  async listRooms(): Promise<RoomSummary[]> {
    const r = await this.http('/api/rooms');
    if (r.status !== 200) this.fail(r);
    return RoomListResponseSchema.parse(await r.json()).rooms;
  }

  /** Server wall time for ClockSync (decision 0009). */
  async serverTime(): Promise<number> {
    const r = await this.http('/api/time');
    if (!r.ok) throw new ClientError('SERVER_OFFLINE');
    return TimeResponseSchema.parse(await r.json()).serverMs;
  }

  private async ensureCsrf(): Promise<string> {
    if (this.csrf) return this.csrf;
    const r = await this.http('/api/csrf');
    if (!r.ok) this.fail(r);
    this.csrf = z.strictObject({ csrfToken: z.string().min(1).max(256) }).parse(await r.json()).csrfToken;
    return this.csrf;
  }

  async join(roomCode: string): Promise<Room> {
    await this.checkVersion();
    const csrf = await this.ensureCsrf();
    const r = await this.http('/api/join-ticket', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ roomCode }) });
    if (r.status !== 200) this.fail(r);
    const t = (await r.json()) as JoinTicketResponse;
    let room: Room;
    try {
      room = await new Client(this.deps.wsEndpoint).joinById(t.roomId, { roomCode, ticket: t.ticket, protocolVersion: PROTOCOL_VERSION, contentHash: CONTENT_HASH });
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      throw new ClientError(/full|locked|SEAT_TAKEN/i.test(m) ? 'ROOM_FULL' : /AUTH_FAILED/.test(m) ? 'INVITE_INVALID' : 'SERVER_OFFLINE');
    }
    this.room = room;
    room.onMessage(MSG, (raw: unknown) => {
      const m = parseServerMsg(raw);
      if (!m) { this.invalid++; return; }
      for (const l of [...this.listeners]) l(m);
    });
    room.onMessage('*', () => { this.invalid++; });
    room.onLeave(() => { if (this.room === room) { this.room = null; for (const l of [...this.closeListeners]) l(); } });
    return room;
  }

  /** Subscribes to validated server messages; returns cleanup. */
  onMessage(l: (m: ServerMsg) => void): () => void { this.listeners.add(l); return () => this.listeners.delete(l); }
  onClose(l: () => void): () => void { this.closeListeners.add(l); return () => this.closeListeners.delete(l); }

  /** Validates before sending; never sends damage, positions or hp (only the §11.2 client messages exist). */
  send(m: ClientMsg): void { this.room?.send(MSG, ClientMsgSchema.parse(m)); }

  async leave(): Promise<void> {
    const r = this.room;
    this.room = null;
    await r?.leave(true).catch(() => undefined);
  }

  dispose(): void { this.listeners.clear(); this.closeListeners.clear(); void this.leave(); }
}
