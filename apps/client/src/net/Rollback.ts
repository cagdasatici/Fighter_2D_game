import { checksum, cloneState, createMatch, step, type FxEvent, type InputByte, type MatchState } from '@kb/shared';
import type { CharId, ClientMsg, ServerMsg, StageId } from '@kb/shared/net/protocol';

/** Spec §11.4. Pure: no DOM, no clock, no sockets. The caller passes server time, RTT, input and a send function. */
export const MAX_ROLLBACK = 12;
export const SNAPSHOT_RING = 16;
export const HASH_MEMORY = 4;

export interface RollbackStart { seed: number; chars: [CharId, CharId]; stage: StageId; you: 0 | 1; startAtMs: number; delay: number }
type Pair = [InputByte, InputByte];

export function leadFrames(rttMs: number): number {
  const v = Math.ceil((rttMs / 2) * 60 / 1000) + 1;
  return v < 1 ? 1 : v > 8 ? 8 : v;
}

export class Rollback {
  confirmed: MatchState;
  current: MatchState;
  /** Last confirmed frame (`cf`). */
  cf = 0;
  currentFrame = 0;
  readonly you: 0 | 1;
  readonly them: 0 | 1;
  readonly delay: number;
  readonly startAtMs: number;
  /** True when the last tick hit MAX_ROLLBACK and rendered the same frame. */
  stalled = false;
  ended: { winner: 0 | 1 | null } | null = null;
  rollbacks = 0;
  resyncs = 0;
  private readonly localInputs = new Map<number, InputByte>();
  private readonly confirmedInputs = new Map<number, Pair>();
  /** Inputs actually used to predict frames (cf, currentFrame]. */
  private readonly used = new Map<number, Pair>();
  private snapshots: { frame: number; state: MatchState }[] = [];
  private lastConfirmedTheirs: InputByte = 0;
  /** Confirmed checksums at hash frames (last HASH_MEMORY) and server hashes not reached yet. */
  private readonly myHashes = new Map<number, number>();
  private readonly serverHashes = new Map<number, number>();
  /** Events from frames shown for the first time; frames already shown are never replayed (lastFxFrame). */
  private lastFxFrame = 0;
  private fresh: FxEvent[] = [];

  constructor(start: RollbackStart, private readonly send: (m: ClientMsg) => void) {
    this.confirmed = createMatch({ chars: start.chars, stage: start.stage, seed: start.seed });
    this.current = cloneState(this.confirmed);
    this.you = start.you; this.them = start.you === 0 ? 1 : 0;
    this.delay = start.delay; this.startAtMs = start.startAtMs;
  }

  targetFrame(serverNowMs: number, rttMs: number): number {
    return Math.floor((serverNowMs - this.startAtMs) * 60 / 1000) + leadFrames(rttMs);
  }

  /** One render tick (§11.4 step 2). `sample` is called once per predicted frame. */
  tick(serverNowMs: number, rttMs: number, sample: () => InputByte): void {
    if (this.ended) return;
    const target = this.targetFrame(serverNowMs, rttMs);
    this.stalled = false;
    while (this.currentFrame < target) {
      if (this.currentFrame - this.cf >= MAX_ROLLBACK) { this.stalled = true; break; }
      const f = this.currentFrame + 1 + this.delay;
      if (!this.localInputs.has(f)) {
        const b = sample() & 255;
        this.localInputs.set(f, b);
        this.send({ t: 'in', f, b });
      }
      this.advanceCurrent(true);
    }
  }

  private inputsFor(frame: number): Pair {
    const pair: Pair = [0, 0];
    pair[this.you] = this.localInputs.get(frame) ?? 0;
    pair[this.them] = this.confirmedInputs.get(frame)?.[this.them] ?? this.lastConfirmedTheirs;
    return pair;
  }

  private advanceCurrent(show: boolean): void {
    const frame = this.currentFrame + 1;
    const pair = this.inputsFor(frame);
    step(this.current, pair);
    this.currentFrame = frame;
    this.used.set(frame, pair);
    this.snapshots.push({ frame, state: cloneState(this.current) });
    if (this.snapshots.length > SNAPSHOT_RING) this.snapshots.shift();
    if (show && frame > this.lastFxFrame) { this.lastFxFrame = frame; this.fresh.push(...this.current.events); }
  }

  /** Events of newly shown frames since the last call (rollback re-simulation never adds any). */
  takeEvents(): FxEvent[] { const e = this.fresh; this.fresh = []; return e; }

  onMessage(m: ServerMsg): void {
    if (m.t === 'cf') this.onConfirmed(m.f, m.b);
    else if (m.t === 'hash') this.onHash(m.f, m.h);
    else if (m.t === 'snap') this.onSnap(m.f, m.state);
    else if (m.t === 'end') this.onEnd(m.winner);
  }

  /** §11.4 steps 3-4. */
  private onConfirmed(first: number, pairs: [number, number][]): void {
    if (first > this.cf + 1) { this.requestResync(); return; } // gap: cannot happen on an ordered socket
    let rollbackFrom: number | null = null;
    for (let i = 0; i < pairs.length; i++) {
      const f = first + i;
      if (f <= this.cf) continue;
      const pair: Pair = [pairs[i]![0], pairs[i]![1]];
      this.confirmedInputs.set(f, pair);
      const usedPair = this.used.get(f);
      if (f <= this.currentFrame && usedPair && (usedPair[0] !== pair[0] || usedPair[1] !== pair[1]))
        rollbackFrom = rollbackFrom === null ? f : Math.min(rollbackFrom, f);
      step(this.confirmed, pair);
      this.cf = f;
      this.lastConfirmedTheirs = pair[this.them];
      if (f % 60 === 0) this.noteHash(f, checksum(this.confirmed));
    }
    if (this.cf >= this.currentFrame) {
      // The server is ahead of our prediction: jump to the confirmed state (no FX for skipped frames).
      if (this.cf > this.currentFrame || rollbackFrom !== null) this.current = cloneState(this.confirmed);
      this.currentFrame = this.cf; this.snapshots = []; this.lastFxFrame = Math.max(this.lastFxFrame, this.cf);
    } else if (rollbackFrom !== null) {
      this.rollbacks++;
      const snap = rollbackFrom - 1 > this.cf ? this.snapshots.find(s => s.frame === rollbackFrom - 1) : undefined;
      const target = this.currentFrame;
      this.current = cloneState(snap ? snap.state : this.confirmed);
      this.currentFrame = snap ? snap.frame : this.cf;
      this.snapshots = this.snapshots.filter(s => s.frame <= this.currentFrame);
      while (this.currentFrame < target) this.advanceCurrent(false);
    }
    this.prune();
  }

  private prune(): void {
    for (const map of [this.localInputs, this.confirmedInputs, this.used] as Map<number, unknown>[])
      for (const k of map.keys()) if (k <= this.cf) map.delete(k);
    this.snapshots = this.snapshots.filter(s => s.frame > this.cf);
  }

  private noteHash(f: number, h: number): void {
    this.myHashes.set(f, h);
    if (this.myHashes.size > HASH_MEMORY) this.myHashes.delete(this.myHashes.keys().next().value!);
    const server = this.serverHashes.get(f);
    if (server !== undefined) { this.serverHashes.delete(f); this.compare(f, server); }
  }

  /** §11.4 step 5. */
  private onHash(f: number, h: number): void {
    if (f > this.cf) {
      this.serverHashes.set(f, h);
      if (this.serverHashes.size > HASH_MEMORY) this.serverHashes.delete(this.serverHashes.keys().next().value!);
      return;
    }
    if (this.myHashes.has(f)) this.compare(f, h);
  }

  private compare(f: number, server: number): void {
    const mine = this.myHashes.get(f)!;
    this.send({ t: 'ack', f, h: mine });
    if (mine !== server) this.requestResync();
  }

  private requestResync(): void { this.resyncs++; this.send({ t: 'resync' }); }

  /** The server's confirmed stream is final: drop any prediction past `cf` (it never happened). */
  private onEnd(winner: 0 | 1 | null): void {
    this.ended = { winner };
    if (this.currentFrame > this.cf) {
      this.current = cloneState(this.confirmed); this.currentFrame = this.cf;
      this.snapshots = []; this.used.clear();
    }
  }

  private onSnap(f: number, state: MatchState): void {
    this.confirmed = cloneState(state);
    this.current = cloneState(state);
    this.snapshots = [];
    this.used.clear();
    this.serverHashes.clear(); this.myHashes.clear();
    this.cf = f; this.currentFrame = f;
    this.lastFxFrame = Math.max(this.lastFxFrame, f);
    this.prune();
  }
}
