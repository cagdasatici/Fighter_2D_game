/**
 * Server clock estimate (copied from battlegrounds, adapted for decision 0009): HTTP `/api/time` ping midpoint,
 * median of the last 8 offsets and round trips, corrections clamped to 5 ms per call unless (re)starting.
 * Pure: the caller supplies local times, so tests drive it with a fake clock.
 */
export const CLOCK = { samples: 8, maxCorrectionMsPerFrame: 5 } as const;

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export class ClockSync {
  private offsets: number[] = [];
  private rtts: number[] = [];
  private pending = new Map<number, number>();
  private nonce = 0;
  private snapNext = true;
  /** Applied offset: serverMs ~= localMs + offsetMs. */
  offsetMs = 0;

  /** Registers an outgoing ping; returns its nonce. */
  makePing(localMs: number): number {
    this.nonce = (this.nonce + 1) >>> 0;
    this.pending.set(this.nonce, localMs);
    if (this.pending.size > 16) this.pending.delete(this.pending.keys().next().value as number);
    return this.nonce;
  }

  /** Records a pong. Unknown or duplicate nonces and non-finite times are ignored. */
  onPong(nonce: number, serverMs: number, localMs: number): boolean {
    const sent = this.pending.get(nonce);
    if (sent === undefined || !Number.isFinite(serverMs) || localMs < sent) return false;
    this.pending.delete(nonce);
    this.offsets.push(serverMs - (sent + localMs) / 2);
    this.rtts.push(localMs - sent);
    if (this.offsets.length > CLOCK.samples) { this.offsets.shift(); this.rtts.shift(); }
    return true;
  }

  get ready(): boolean { return this.offsets.length > 0; }
  get targetOffsetMs(): number { return this.offsets.length === 0 ? this.offsetMs : median(this.offsets); }
  /** Median round trip in ms (0 before the first pong). */
  get rttMs(): number { return this.rtts.length === 0 ? 0 : median(this.rtts); }

  /** Call once per tick. Moves the applied offset at most 5 ms toward the median (first sample snaps). */
  frame(): void {
    const t = this.targetOffsetMs;
    if (this.snapNext && this.offsets.length > 0) { this.offsetMs = t; this.snapNext = false; return; }
    const k = CLOCK.maxCorrectionMsPerFrame;
    this.offsetMs += Math.max(-k, Math.min(k, t - this.offsetMs));
  }

  reset(): void { this.offsets = []; this.rtts = []; this.pending.clear(); this.snapNext = true; }
  serverMs(localMs: number): number { return localMs + this.offsetMs; }
}
