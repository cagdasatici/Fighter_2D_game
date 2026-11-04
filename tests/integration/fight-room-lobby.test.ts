import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import type { Server } from "colyseus";
import { Client, type Room } from "@colyseus/sdk";
import { createGameServer } from "../../apps/server/src/createServer.js";
import { createAuthServices, type AuthServices } from "../../apps/server/src/auth/Services.js";
import { CONTENT_HASH, MSG, PROTOCOL_VERSION, type LobbyMsg } from "../../packages/shared/src/net/protocol.js";

// S12a: FightRoom placeholder (join/leave + lobby). Full input authority tests arrive with S12b (tests/integration/fight-room.test.ts).
const PORT = 25681;
const ORIGIN = `http://localhost:${PORT}`;
let server: Server;
let svc: AuthServices;

async function ticket(name: string): Promise<{ ticket: string; roomId: string }> {
  const { token } = svc.invites.create({ ttlMs: 60_000, maxUses: 1 });
  const s = await fetch(`${ORIGIN}/api/session`, { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: JSON.stringify({ invite: token, displayName: name }) });
  const cookie = (s.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  const { csrfToken } = await (await fetch(`${ORIGIN}/api/csrf`, { headers: { cookie } })).json() as { csrfToken: string };
  const r = await fetch(`${ORIGIN}/api/join-ticket`, { method: "POST", headers: { origin: ORIGIN, cookie, "x-csrf-token": csrfToken, "content-type": "application/json" }, body: JSON.stringify({ roomCode: "play" }) });
  expect(r.status).toBe(200);
  return await r.json() as { ticket: string; roomId: string };
}

async function joinFight(name: string): Promise<{ room: Room; lobbies: LobbyMsg[] }> {
  const t = await ticket(name);
  const room = await new Client(ORIGIN).joinById(t.roomId, { roomCode: "play", ticket: t.ticket, protocolVersion: PROTOCOL_VERSION, contentHash: CONTENT_HASH });
  const lobbies: LobbyMsg[] = [];
  room.onMessage(MSG, (m: LobbyMsg) => { lobbies.push(m); });
  return { room, lobbies };
}

async function waitFor(cond: () => boolean, ms = 3000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 10));
  }
}

beforeAll(async () => {
  svc = createAuthServices({ dataDir: mkdtempSync(join(tmpdir(), "kb-fight-")), allowedOrigins: [ORIGIN], secureCookies: false,
    roomCodes: { play: "fight" }, buildId: "test", sessionsPerMinute: 1000, globalSessionsPerMinute: 1000 });
  server = createGameServer(svc);
  await server.listen(PORT, undefined, undefined);
});
afterAll(async () => { await server.gracefullyShutdown(false); });

describe("FightRoom placeholder", () => {
  test("two players join, lobby lists both, third is refused, leave updates lobby", async () => {
    const a = await joinFight("Arel");
    const b = await joinFight("Nora");
    await waitFor(() => b.lobbies.some((l) => l.slots.length === 2));
    expect(b.lobbies.at(-1)!.slots.map((s) => s.name)).toEqual(["Arel", "Nora"]);
    const third = await ticket("Third").catch(() => null);
    expect(third).toBeNull(); // join-ticket answers 409 ROOM_FULL (expect inside ticket() throws)
    await b.room.leave();
    await waitFor(() => a.lobbies.at(-1)?.slots.length === 1);
    expect(a.lobbies.at(-1)!.slots[0]!.name).toBe("Arel");
    await a.room.leave();
  });
  test("a bad ticket is refused", async () => {
    const t = await ticket("Arel");
    await expect(new Client(ORIGIN).joinById(t.roomId, { roomCode: "play", ticket: "0".repeat(64), protocolVersion: PROTOCOL_VERSION, contentHash: CONTENT_HASH })).rejects.toBeTruthy();
  });
});
