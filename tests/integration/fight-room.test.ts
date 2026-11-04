import { createMatch, step, checksum } from "../../packages/shared/src/index.js";
import { parseServerMsg } from "../../packages/shared/src/net/protocol.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { Server } from "colyseus";
import { Client, type Room } from "@colyseus/sdk";
import { createGameServer } from "../../apps/server/src/createServer.js";
import { createAuthServices, type AuthServices } from "../../apps/server/src/auth/Services.js";
import { CONTENT_HASH, MSG, PROTOCOL_VERSION, type ServerMsg } from "../../packages/shared/src/net/protocol.js";

// Real SDK clients exercise S12b against the authenticated server.
const PORT = 25682;
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
  svc = createAuthServices({ dataDir: mkdtempSync(join(tmpdir(), "kb-fight-")), allowedOrigins: [ORIGIN], secureCookies: false,
    roomCodes: { play: "fight" }, buildId: "test", sessionsPerMinute: 1000, globalSessionsPerMinute: 1000 });
  server = createGameServer(svc);
  await server.listen(PORT, undefined, undefined);
});
afterAll(async () => { await server.gracefullyShutdown(false); });


test("two-human authority, replay, snapshots, reconnect and forfeit", async () => {
  const a = await joinFight("Arel"), b = await joinFight("Nora");
  const rooms = [a, b];
  for (const [i, c] of rooms.entries()) {
    c.room.send(MSG, { t: "pick", char: i === 0 ? "bolt" : "bao" });
    c.room.send(MSG, { t: "ready" });
  }
  await waitFor(() => rooms.every((c) => c.messages.some((m) => m.t === "start")));
  const start = a.messages.find((m) => m.t === "start")!;
  if (start.t !== "start") throw new Error("no start");
  expect(start.delay).toBe(2); expect(start.stage).toBe("rooftop");
  expect(b.messages.find((m) => m.t === "start")).toEqual({ ...start, you: 1 });
  const replay = createMatch({ chars: start.chars, stage: start.stage, seed: start.seed });
  const pairs = new Map<number, [number, number]>();
  const localHashes = new Map<number, number>();
  // 60 inputs/s per client, below the real server token bucket limit.
  for (let base = 1; base <= 600; base += 6) {
    for (let f = base; f < base + 6; f++) {
      a.room.send(MSG, { t: "in", f, b: f % 120 < 60 ? 4 : 0 });
      b.room.send(MSG, { t: "in", f, b: f % 120 === 0 ? 16 : 0 });
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  await waitFor(() => a.messages.some((m) => m.t === "cf" && m.f + m.b.length > 600));
  for (const m of a.messages) if (m.t === "cf") m.b.forEach((pair, i) => pairs.set(m.f + i, pair));
  for (let f = 1; f <= 600; f++) {
    expect(pairs.has(f)).toBe(true);
    step(replay, pairs.get(f)!);
    if (f % 60 === 0) localHashes.set(f, checksum(replay));
  }
  expect(a.messages.filter((m) => m.t === "hash" && m.f <= 600)).toHaveLength(10);
  for (const m of a.messages) {
    expect(parseServerMsg(m)).not.toBeNull();
    if (m.t === "hash" && m.f <= 600) expect(m.h).toBe(localHashes.get(m.f));
  }
  for (const m of b.messages) if (m.t === "hash" && m.f <= 600) expect(m.h).toBe(localHashes.get(m.f));
  a.room.send(MSG, { t: "ack", f: 600, h: (localHashes.get(600)! ^ 1) >>> 0 });
  await waitFor(() => a.messages.some((m) => m.t === "snap"));
  const snaps = () => a.messages.filter((m) => m.t === "snap");
  a.room.send(MSG, { t: "resync" });
  await new Promise((r) => setTimeout(r, 100));
  expect(snaps()).toHaveLength(1);
  // No more inputs: the next missing frame must wait for its 100 ms deadline.
  a.room.send(MSG, { t: "in", f: 1, b: 255 }); // Already confirmed: ignored.
  const next = 700;
  await waitFor(() => a.messages.some((m) => m.t === "cf" && m.f + m.b.length > next), 5000);
  expect(Date.now()).toBeGreaterThanOrEqual(start.startAtMs + next * 1000 / 60 + 100);
  const last = a.messages.filter((m) => m.t === "cf").at(-1)!;
  if (last.t !== "cf") throw new Error("no confirmation");
  expect(last.b.at(-1)).toEqual(pairs.get(600));
  // A genuine dropped websocket reserves the slot and supplies neutral input.
  const token = b.room.reconnectionToken;
  const beforeDrop = a.messages.filter((m) => m.t === "cf").length;
  b.room.reconnection.enabled = false;
  b.room.connection.close(4010, "test drop");
  await new Promise((r) => setTimeout(r, 150));
  await waitFor(() => a.messages.filter((m) => m.t === "cf").length > beforeDrop);
  const duringDrop = a.messages.filter((m) => m.t === "cf").at(-1)!;
  if (duringDrop.t !== "cf") throw new Error("no disconnect confirmation");
  expect(duringDrop.b.at(-1)![1]).toBe(0);
  const resumed = await new Client(ORIGIN).reconnect(token);
  const resumedMessages: ServerMsg[] = [];
  resumed.onMessage(MSG, (m: ServerMsg) => resumedMessages.push(m));
  await waitFor(() => resumedMessages.some((m) => m.t === "snap"));
  const snap = resumedMessages.find((m) => m.t === "snap")!;
  if (snap.t !== "snap") throw new Error("no reconnect snap");
  expect(snap.state.frame).toBeGreaterThan(600);
  resumed.reconnection.enabled = false;
  resumed.connection.close(4010, "test drop");
  await waitFor(() => a.messages.some((m) => m.t === "end" && m.winner === 0), 23000);
  await a.room.leave();
}, 45000);

test("scripted KO emits end and both rematch votes create a fresh match", async () => {
  const a = await joinFight("Arel"), b = await joinFight("Nora");
  try {
    a.room.send(MSG, { t: "pick", char: "bolt" }); a.room.send(MSG, { t: "ready" });
    b.room.send(MSG, { t: "pick", char: "bao" }); b.room.send(MSG, { t: "ready" });
    await waitFor(() => a.messages.some((m) => m.t === "start"));
    const initial = a.messages.find((m) => m.t === "start")!;
    if (initial.t !== "start") throw new Error("no start");
    for (let base = 1; base <= 3300 && !a.messages.some((m) => m.t === "end"); base += 8) {
      for (let f = base; f < base + 8; f++) {
        a.room.send(MSG, { t: "in", f, b: 8 | (f % 60 === 0 ? 32 : 0) });
        b.room.send(MSG, { t: "in", f, b: 0 });
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    await waitFor(() => a.messages.some((m) => m.t === "end"));
    expect(a.messages.find((m) => m.t === "end")).toEqual({ t: "end", winner: 0 });
    const replay = createMatch({ chars: initial.chars, stage: initial.stage, seed: initial.seed });
    for (const m of a.messages) if (m.t === "cf") for (const pair of m.b) step(replay, pair);
    expect(replay.phase).toBe("matchEnd"); expect(replay.winner).toBe(0);
    a.room.send(MSG, { t: "rematch" });
    await new Promise((r) => setTimeout(r, 100));
    expect(a.messages.filter((m) => m.t === "start")).toHaveLength(1);
    b.room.send(MSG, { t: "rematch" });
    await waitFor(() => a.messages.filter((m) => m.t === "start").length === 2);
    const next = a.messages.filter((m) => m.t === "start").at(-1)!;
    if (next.t !== "start") throw new Error("no rematch start");
    expect(next.chars).toEqual(initial.chars);
    expect(next.seed).not.toBe(initial.seed);
    expect(next.startAtMs).toBeGreaterThan(initial.startAtMs);
    a.room.send(MSG, { t: "resync" });
    await waitFor(() => a.messages.some((m) => m.t === "snap" && m.f === 0));
    const snap = a.messages.find((m) => m.t === "snap" && m.f === 0)!;
    if (snap.t !== "snap") throw new Error("no rematch snapshot");
    expect(snap.state.fighters[0].wins).toBe(0);
    expect(snap.state.fighters[1].hp).toBe(createMatch({ chars: initial.chars, stage: initial.stage, seed: next.seed }).fighters[1].hp);
  } finally { await b.room.leave(); await a.room.leave(); }
}, 50000);
