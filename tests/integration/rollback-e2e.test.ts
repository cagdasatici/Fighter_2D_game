import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import type { Server } from "colyseus";
import { createGameServer } from "../../apps/server/src/createServer.js";
import { createAuthServices, type AuthServices } from "../../apps/server/src/auth/Services.js";
import { checksum } from "../../packages/shared/src/sim/checksum.js";
import { DOWN, LP, RIGHT } from "../../packages/shared/src/input/buttons.js";
import type { ServerMsg } from "../../packages/shared/src/net/protocol.js";
import { RoomClient } from "../../apps/client/src/net/RoomClient.js";
import { ClockSync } from "../../apps/client/src/net/ClockSync.js";
import { Rollback } from "../../apps/client/src/net/Rollback.js";

// S13: the real client stack (RoomClient + ClockSync + Rollback) against the real server.
const PORT = 25684;
const ORIGIN = `http://localhost:${PORT}`;
let server: Server;
let svc: AuthServices;

/** Node has no browser cookie jar: keep the session cookie and send the page Origin. */
function cookieFetch(): typeof fetch {
  let cookie = "";
  return (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set("origin", ORIGIN);
    if (cookie) headers.set("cookie", cookie);
    const r = await fetch(input, { ...init, headers });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0] ?? "";
    return r;
  }) as typeof fetch;
}

async function waitFor(cond: () => boolean, ms = 5000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 10));
  }
}

beforeAll(async () => {
  svc = createAuthServices({ dataDir: mkdtempSync(join(tmpdir(), "kb-rb-")), allowedOrigins: [ORIGIN], secureCookies: false,
    roomCodes: { duel: "fight" }, buildId: "test", sessionsPerMinute: 1000, globalSessionsPerMinute: 1000 });
  server = createGameServer(svc);
  await server.listen(PORT, undefined, undefined);
});
afterAll(async () => { await server.gracefullyShutdown(false); });

test("two rollback clients play 360 frames and agree with every server hash", async () => {
  const players = await Promise.all((["Arel", "Nora"] as const).map(async (name, i) => {
    const client = new RoomClient({ httpBase: ORIGIN, wsEndpoint: `ws://localhost:${PORT}`, fetchFn: cookieFetch() });
    await client.login(svc.invites.create({ ttlMs: 60_000, maxUses: 1 }).token, name);
    expect((await client.listRooms()).map((r) => r.roomCode)).toEqual(["duel"]);
    const clock = new ClockSync();
    const messages: ServerMsg[] = [];
    const p = { client, clock, messages, rb: null as Rollback | null, i, acks: 0 };
    client.onMessage((m) => { messages.push(m); if (m.t === "start") p.rb = new Rollback(m, (out) => { if (out.t === "ack") p.acks++; client.send(out); }); else p.rb?.onMessage(m); });
    return p;
  }));
  for (const p of players) await p.client.join("duel");
  for (const p of players) {
    for (let k = 0; k < 4; k++) { const n = p.clock.makePing(Date.now()); p.clock.onPong(n, await p.client.serverTime(), Date.now()); }
    p.client.send({ t: "pick", char: p.i === 0 ? "bolt" : "kaze" });
    p.client.send({ t: "ready" });
  }
  await waitFor(() => players.every((p) => p.rb !== null));
  const script = (i: number, f: number): number => i === 0 ? (f % 90 < 40 ? RIGHT : f % 90 === 50 ? LP : 0) : (f % 120 < 30 ? DOWN : 0);
  const timer = setInterval(() => {
    for (const p of players) {
      p.clock.frame();
      p.rb!.tick(p.clock.serverMs(Date.now()), p.clock.rttMs, () => script(p.i, p.rb!.currentFrame + 1));
    }
  }, 16);
  try {
    await waitFor(() => players.every((p) => p.rb!.cf >= 360), 14_000);
  } finally { clearInterval(timer); }
  for (const p of players) {
    const hashes = p.messages.filter((m) => m.t === "hash" && m.f <= 360);
    expect(hashes.length).toBe(6);
    expect(p.messages.some((m) => m.t === "snap")).toBe(false);
    expect(p.acks).toBeGreaterThanOrEqual(6); // every hash compared and acknowledged
    expect(p.rb!.resyncs).toBe(0);
    expect(p.client.invalid).toBe(0);
  }
  const [a, b] = players.map((p) => p.rb!) as [Rollback, Rollback];
  const common = Math.min(a.cf, b.cf);
  expect(common).toBeGreaterThanOrEqual(360);
  // Both clients replayed the same confirmed stream.
  if (a.cf === b.cf) expect(checksum(a.confirmed)).toBe(checksum(b.confirmed));
  for (const p of players) await p.client.leave();
}, 30_000);
