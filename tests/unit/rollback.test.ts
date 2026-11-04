import { describe, expect, it } from "vitest";
import { checksum } from "../../packages/shared/src/sim/checksum.js";
import { cloneState, createMatch } from "../../packages/shared/src/sim/state.js";
import { step } from "../../packages/shared/src/sim/step.js";
import { LP, RIGHT, UP } from "../../packages/shared/src/input/buttons.js";
import type { MatchState } from "../../packages/shared/src/sim/types.js";
import type { ClientMsg, ServerMsg } from "../../packages/shared/src/net/protocol.js";
import { MAX_ROLLBACK, Rollback, leadFrames, type RollbackStart } from "../../apps/client/src/net/Rollback.js";
import { ClockSync } from "../../apps/client/src/net/ClockSync.js";
import { at } from "../helpers/fight.js";

const FRAME_MS = 1000 / 60;
const START: RollbackStart = { seed: 12345, chars: ["bolt", "kaze"], stage: "rooftop", you: 0, startAtMs: 1000, delay: 2 };

/** Seeded xorshift for test randomness (never Math.random). */
function rng(seed: number): (n: number) => number {
  let x = seed >>> 0 || 1;
  return (n) => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x % n; };
}

/** Spec §11.3 confirmation rule on a fake clock: both inputs, or the 100 ms deadline (previous input repeats). */
class FakeServer {
  state: MatchState;
  hashesAt = new Map<number, number>();
  private pending = new Map<number, [number | null, number | null]>();
  private previous: [number, number] = [0, 0];
  snaps = 0;
  constructor(start: RollbackStart, private readonly out: (slot: 0 | 1, m: ServerMsg) => void) {
    this.state = createMatch({ chars: start.chars, stage: start.stage, seed: start.seed });
  }
  receive(slot: 0 | 1, m: ClientMsg): void {
    if (m.t === "in" && m.f > this.state.frame) {
      const pair = this.pending.get(m.f) ?? [null, null];
      if (pair[slot] === null) pair[slot] = m.b;
      this.pending.set(m.f, pair);
    } else if (m.t === "ack" && this.hashesAt.get(m.f) !== m.h) this.snap(slot);
    else if (m.t === "resync") this.snap(slot);
  }
  snap(slot: 0 | 1): void { this.snaps++; this.out(slot, { t: "snap", f: this.state.frame, state: cloneState(this.state) }); }
  confirm(now: number): void {
    const first = this.state.frame + 1, batch: [number, number][] = [], hashes: ServerMsg[] = [];
    for (;;) {
      const f = this.state.frame + 1;
      const pair = this.pending.get(f) ?? [null, null];
      if ((pair[0] === null || pair[1] === null) && now < START.startAtMs + f * FRAME_MS + 100) break;
      const c: [number, number] = [pair[0] ?? this.previous[0], pair[1] ?? this.previous[1]];
      this.pending.delete(f); this.previous = c;
      step(this.state, c); batch.push(c);
      this.hashesAt.set(f, checksum(this.state));
      if (f % 60 === 0) hashes.push({ t: "hash", f, h: this.hashesAt.get(f)! });
    }
    for (const slot of [0, 1] as const) {
      if (batch.length) this.out(slot, { t: "cf", f: first, b: batch });
      for (const h of hashes) this.out(slot, h);
    }
  }
}

/** Two Rollback clients + fake server; client→server `in` delayed 0..10 random frames, server→client 30 ms in order. */
function runOnline(seed: number, endMs: number) {
  const r = rng(seed);
  const queue: { at: number; deliver: () => void; order: number }[] = [];
  let now = 0, order = 0;
  const later = (ms: number, deliver: () => void) => queue.push({ at: now + ms, deliver, order: order++ });
  const clients: Rollback[] = [];
  const server = new FakeServer(START, (slot, m) => later(30, () => clients[slot]!.onMessage(m)));
  for (const you of [0, 1] as const)
    clients.push(new Rollback({ ...START, you }, (m) => later(m.t === "in" ? r(11) * FRAME_MS : 30, () => server.receive(you, m))));
  const held: [number, number] = [0, 0];
  const sample = (i: 0 | 1) => () => { if (r(20) === 0) held[i] = r(256); return held[i]; };
  let nextTick = 0;
  const runUntil = (t: number, ticking: boolean) => {
    for (; now <= t; now++) {
      queue.sort((a, b) => a.at - b.at || a.order - b.order);
      while (queue.length && queue[0]!.at <= now) queue.shift()!.deliver();
      server.confirm(now);
      if (ticking && now >= nextTick) { nextTick += FRAME_MS; for (const i of [0, 1] as const) clients[i]!.tick(now, 60, sample(i)); }
    }
  };
  return { clients, server, runUntil };
}

describe("S13 rollback (spec §16)", () => {
  it("two clients with 0..10 frame input delay end on the server's checksums", () => {
    const { clients, server, runUntil } = runOnline(99, 0);
    runUntil(START.startAtMs + 12_000, true);
    // Stop the clients; the server confirms past their predictions by deadline, so each jumps to confirmed.
    runUntil(START.startAtMs + 13_000, false);
    expect(server.state.frame).toBeGreaterThan(700);
    for (const c of clients) {
      expect(c.cf).toBeGreaterThanOrEqual(server.state.frame - 3); // at most the 30 ms in flight
      expect(checksum(c.confirmed)).toBe(server.hashesAt.get(c.cf));
      expect(c.currentFrame).toBe(c.cf);
      expect(checksum(c.current)).toBe(server.hashesAt.get(c.cf));
      expect(c.rollbacks).toBeGreaterThan(0);
      expect(c.resyncs).toBe(0);
    }
    expect(server.snaps).toBe(0);
  });

  it("stalls at MAX_ROLLBACK frames ahead of the last confirmed frame", () => {
    const sent: ClientMsg[] = [];
    const rb = new Rollback(START, (m) => sent.push(m));
    rb.tick(START.startAtMs + 10_000, 0, () => 0);
    expect(rb.currentFrame).toBe(MAX_ROLLBACK);
    expect(rb.stalled).toBe(true);
    rb.tick(START.startAtMs + 10_100, 0, () => 0);
    expect(rb.currentFrame).toBe(MAX_ROLLBACK);
    expect(sent.filter((m) => m.t === "in").map((m) => m.t === "in" && m.f)).toEqual(Array.from({ length: MAX_ROLLBACK }, (_, i) => i + 1 + START.delay));
    rb.onMessage({ t: "cf", f: 1, b: [[0, 0]] });
    rb.tick(START.startAtMs + 10_200, 0, () => 0);
    expect(rb.currentFrame).toBe(MAX_ROLLBACK + 1);
  });

  it("rolls back its own input when the server replaced a late one", () => {
    const rb = new Rollback({ ...START, delay: 0 }, () => {});
    // Fight-phase state so inputs matter.
    const s = at(120);
    rb.onMessage({ t: "snap", f: s.frame, state: s });
    const base = s.frame;
    rb.tick(START.startAtMs + (base + 5) * FRAME_MS, 0, () => RIGHT);
    expect(rb.currentFrame).toBe(base + 6);
    // Server confirms frame base+1 with my input missing (0), theirs 0.
    rb.onMessage({ t: "cf", f: base + 1, b: [[0, 0]] });
    expect(rb.rollbacks).toBe(1);
    const ref = cloneState(s);
    step(ref, [0, 0]);
    for (let f = base + 2; f <= base + 6; f++) step(ref, [RIGHT, 0]);
    expect(checksum(rb.current)).toBe(checksum(ref));
  });

  it("recovers from a forced desync via ack mismatch, resync and snap", () => {
    const sent: ClientMsg[] = [];
    const rb = new Rollback(START, (m) => sent.push(m));
    const server = createMatch({ chars: START.chars, stage: START.stage, seed: START.seed });
    const pairs: [number, number][] = [];
    for (let f = 1; f <= 60; f++) { pairs.push([0, 0]); step(server, [0, 0]); }
    rb.onMessage({ t: "cf", f: 1, b: pairs.slice(0, 30) });
    rb.confirmed.fighters[0].hp -= 1; // forced desync
    rb.onMessage({ t: "cf", f: 31, b: pairs.slice(30) });
    rb.onMessage({ t: "hash", f: 60, h: checksum(server) });
    expect(sent.some((m) => m.t === "ack" && m.f === 60 && m.h !== checksum(server))).toBe(true);
    expect(sent.some((m) => m.t === "resync")).toBe(true);
    rb.onMessage({ t: "snap", f: 60, state: cloneState(server) });
    expect(checksum(rb.confirmed)).toBe(checksum(server));
    expect(checksum(rb.current)).toBe(checksum(server));
    expect(rb.cf).toBe(60); expect(rb.currentFrame).toBe(60);
  });

  it("does not replay FX of already shown frames after a rollback", () => {
    const rb = new Rollback({ ...START, delay: 0 }, () => {});
    const s = at(60);
    rb.onMessage({ t: "snap", f: s.frame, state: s });
    const base = s.frame;
    let shown = 0;
    for (let i = 1; i <= MAX_ROLLBACK; i++) {
      rb.tick(START.startAtMs + (base + i - 1) * FRAME_MS, 0, () => (i <= 2 ? LP : 0));
      shown += rb.takeEvents().length;
    }
    expect(shown).toBeGreaterThan(0); // the jab produced events in predicted frames
    // Remote turns out to have jumped on the first frame: re-simulate every shown frame.
    rb.onMessage({ t: "cf", f: base + 1, b: [[LP, UP]] });
    expect(rb.rollbacks).toBe(1);
    expect(rb.takeEvents()).toEqual([]);
  });

  it("lead and clock helpers follow §11.4", () => {
    expect(leadFrames(0)).toBe(1);
    expect(leadFrames(100)).toBe(4);
    expect(leadFrames(1000)).toBe(8);
    const c = new ClockSync();
    const n = c.makePing(100);
    expect(c.onPong(n, 5050, 140)).toBe(true);
    expect(c.onPong(n, 5050, 140)).toBe(false);
    c.frame();
    expect(c.serverMs(200)).toBe(200 + 5050 - 120);
    expect(c.rttMs).toBe(40);
  });
});
