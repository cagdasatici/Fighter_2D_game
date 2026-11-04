import { Server, matchMaker } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { FIGHT_ROOM_NAME, MAX_CLIENTS } from "@kb/shared/net/protocol";
import { FightRoom, liveFightRooms, setFightAuth } from "./rooms/FightRoom.js";
import { roomDirectory } from "./rooms/RoomDirectory.js";
import type { AuthServices } from "./auth/Services.js";
import { registerStaticRoutes } from "./http/staticFiles.js";
import { registerSessionRoutes, type HttpApp } from "./http/sessionRoutes.js";

const SESSION_SWEEP_MS = 1000;
const SESSION_TOUCH_MS = 60_000;

export function createGameServer(auth: AuthServices, opts: { staticDir?: string | null } = {}): Server {
  setFightAuth(auth);
  auth.ensureRoom = (name, code) => roomDirectory.ensure(name, code);
  auth.occupancy = (_name, code) => {
    const id = roomDirectory.get(code);
    const room = id ? matchMaker.getLocalRoomById(id) : undefined;
    return { players: room?.clients.length ?? 0, capacity: room?.maxClients ?? MAX_CLIENTS };
  };
  const closing = new Set<string>();
  auth.closeRoom = async (code) => {
    if (closing.has(code)) return;
    const id = roomDirectory.get(code);
    const room = id ? matchMaker.getLocalRoomById(id) : undefined;
    if (room) {
      closing.add(code);
      try { await room.disconnect(); } finally { closing.delete(code); }
    }
  };
  const server = new Server({
    transport: new WebSocketTransport(),
    express: (app: unknown) => {
      registerSessionRoutes(app as HttpApp, auth, auth.now);
      if (opts.staticDir) registerStaticRoutes(app as HttpApp, opts.staticDir, auth.config.allowedOrigins[0]);
    },
  });
  // Joining requires a ticket (onAuth); filterBy keeps each private room code in its own room.
  server.define(FIGHT_ROOM_NAME, FightRoom).filterBy(["roomCode"]);
  // Wall-time lifecycle only: no simulation or damage scheduling. Runs without connected clients.
  const offRevoke = auth.sessions.onRevoke((id) => { for (const room of [...liveFightRooms()]) room.revokeAuthSession(id); });
  let lastAuthSweep = Number.NEGATIVE_INFINITY;
  let lastTouch = auth.now();
  const sweep = setInterval(() => {
    const t = auth.now();
    if (t - lastAuthSweep < SESSION_SWEEP_MS) return;
    lastAuthSweep = t;
    const touchDue = t - lastTouch >= SESSION_TOUCH_MS;
    const live = new Set<string>();
    for (const room of [...liveFightRooms()]) {
      for (const s of room.seatedSessions()) {
        if (auth.sessions.getById(s.authId) === null) room.revokeAuthSession(s.authId);
        else if (s.connected) live.add(s.authId);
      }
    }
    if (touchDue) { lastTouch = t; auth.sessions.touchMany(live); }
  }, 250);
  sweep.unref();
  server.onBeforeShutdown(() => { clearInterval(sweep); offRevoke(); });
  return server;
}
