import type { IncomingMessage } from "node:http";
import { FIGHT_ROOM_NAME, MAX_CLIENTS } from "@kb/shared/net/protocol";
import type { RoomListResponse, RoomSummary } from "@kb/shared/net/rooms";
import type { AuthServices } from "../auth/Services.js";
import type { RateLimiter } from "../auth/RateLimiter.js";
import type { SessionRecord } from "../auth/SessionStore.js";
import { hdr, originAllowed, send, type HttpApp } from "./sessionRoutes.js";

const label = (code: string): string => (code.charAt(0).toUpperCase() + code.slice(1)).slice(0, 32);

/** Pure listing: fight room codes from config. Counts only; no ids, names or tokens. */
export function listRooms(svc: AuthServices): RoomSummary[] {
  const rooms: RoomSummary[] = [];
  for (const [roomCode, roomName] of Object.entries(svc.config.roomCodes)) {
    if (roomName !== FIGHT_ROOM_NAME) continue;
    const meta = svc.roomMeta.get(roomCode);
    if (meta && !meta.listed) continue;
    const o = svc.occupancy(roomName, roomCode);
    rooms.push({ roomCode, name: meta?.name ?? label(roomCode), kind: "fight", players: o.players, capacity: MAX_CLIENTS, bots: meta?.bots ?? 0 });
  }
  return rooms;
}

export function registerRoomListRoutes(
  app: HttpApp, svc: AuthServices, authed: (req: IncomingMessage) => SessionRecord | null | undefined, limiter: RateLimiter,
): void {
  app.get("/api/rooms", (req, res) => {
    if (!originAllowed(req, svc.config.allowedOrigins) && hdr(req, "origin") !== undefined) return send(res, 403, { error: "ORIGIN" });
    const s = authed(req);
    if (!s) return send(res, 401, { error: "UNAUTHENTICATED" });
    if (!limiter.allow(s.id)) return send(res, 429, { error: "RATE_LIMITED" });
    const body: RoomListResponse = { rooms: listRooms(svc) };
    send(res, 200, body);
  });
}
