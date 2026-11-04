import { createMatch, step, checksum, createCpu, cpuInput } from "../../packages/shared/src/index.js";
import { parseServerMsg, parseClientMsg } from "../../packages/shared/src/net/protocol.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { Server } from "colyseus";
import { Client, type Room } from "@colyseus/sdk";
import { createGameServer } from "../../apps/server/src/createServer.js";
import { createAuthServices, type AuthServices } from "../../apps/server/src/auth/Services.js";
import { CONTENT_HASH, MSG, PROTOCOL_VERSION, type ServerMsg } from "../../packages/shared/src/net/protocol.js";

// S12c: a human against a server CPU seat.
const PORT = 25683;
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

async function joinFight(name: string): Promise<{ room: Room; messages: ServerMsg[] }> {
  const t = await ticket(name);
  const room = await new Client(ORIGIN).joinById(t.roomId, { roomCode: "play", ticket: t.ticket, protocolVersion: PROTOCOL_VERSION, contentHash: CONTENT_HASH });
  const messages: ServerMsg[] = [];
  room.onMessage(MSG, (m: ServerMsg) => { messages.push(m); });
  return { room, messages };
}

async function waitFor(cond: () => boolean, ms = 3000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 10));
  }
}

beforeAll(async () => {
  svc = createAuthServices({ dataDir: mkdtempSync(join(tmpdir(), "kb-cpu-")), allowedOrigins: [ORIGIN], secureCookies: false,
    roomCodes: { play: "fight" }, buildId: "test", sessionsPerMinute: 1000, globalSessionsPerMinute: 1000 });
  server = createGameServer(svc);
  await server.listen(PORT, undefined, undefined);
});
afterAll(async () => { await server.gracefullyShutdown(false); });

test("bot message is schema-validated", () => {
  expect(parseClientMsg({ t: "bot", char: "volt", difficulty: "hard" })).not.toBeNull();
  expect(parseClientMsg({ t: "bot", char: "volt", difficulty: "insane" })).toBeNull();
  expect(parseClientMsg({ t: "bot", char: "volt", difficulty: "easy", x: 1 })).toBeNull();
});

test("human vs server CPU: lobby, start, CPU inputs replay to identical hashes, seat refused", async () => {
  const a = await joinFight("Arel");
  a.room.send(MSG, { t: "bot", char: "volt", difficulty: "hard" });
  await waitFor(() => a.messages.some((m) => m.t === "lobby" && m.slots.length === 2));
  const lobby = a.messages.filter((m) => m.t === "lobby").at(-1)!;
  if (lobby.t !== "lobby") throw new Error("no lobby");
  expect(lobby.slots[1]).toEqual({ name: "CPU", char: "volt", ready: true, bot: true });
  expect(lobby.slots[0]!.bot).toBe(false);
  // The CPU holds the second slot: another human is refused.
  await expect(joinFight("Nora")).rejects.toThrow();
  a.room.send(MSG, { t: "pick", char: "bolt" });
  a.room.send(MSG, { t: "ready" });
  await waitFor(() => a.messages.some((m) => m.t === "start"));
  const start = a.messages.find((m) => m.t === "start")!;
  if (start.t !== "start") throw new Error("no start");
  expect(start.chars).toEqual(["bolt", "volt"]); expect(start.you).toBe(0);
  for (let base = 1; base <= 300; base += 6) {
    for (let f = base; f < base + 6; f++) a.room.send(MSG, { t: "in", f, b: f % 90 < 30 ? 4 : 0 });
    await new Promise((r) => setTimeout(r, 100));
  }
  await waitFor(() => a.messages.some((m) => m.t === "cf" && m.f + m.b.length > 300));
  const pairs = new Map<number, [number, number]>();
  for (const m of a.messages) {
    expect(parseServerMsg(m)).not.toBeNull();
    if (m.t === "cf") m.b.forEach((p, i) => pairs.set(m.f + i, p));
  }
  // Replay locally with our own CPU instance: CPU bytes must match the server's exactly.
  const replay = createMatch({ chars: start.chars, stage: start.stage, seed: start.seed });
  const cpu = createCpu({ side: 1, difficulty: "hard", matchSeed: start.seed });
  const hashes = new Map<number, number>();
  let nonZero = 0;
  for (let f = 1; f <= 300; f++) {
    const p = pairs.get(f)!;
    expect(p[0]).toBe(f % 90 < 30 ? 4 : 0);
    expect(p[1]).toBe(cpuInput(cpu, replay));
    if (p[1] !== 0) nonZero++;
    step(replay, p);
    if (f % 60 === 0) hashes.set(f, checksum(replay));
  }
  expect(nonZero).toBeGreaterThan(0);
  for (const m of a.messages) if (m.t === "hash" && m.f <= 300) expect(m.h).toBe(hashes.get(m.f));
  expect(a.messages.filter((m) => m.t === "hash" && m.f <= 300)).toHaveLength(5);
  await a.room.leave();
}, 20_000);
