/** Fixed-size ring of frame times (ms). Allocation-free after construction. */
export const STATS_WINDOW = 120;

export class FrameStats {
  private readonly ring = new Float64Array(STATS_WINDOW);
  private readonly scratch = new Float64Array(STATS_WINDOW);
  private n = 0;
  private head = 0;
  push(ms: number): void {
    this.ring[this.head] = ms;
    this.head = (this.head + 1) % STATS_WINDOW;
    if (this.n < STATS_WINDOW) this.n++;
  }
  get count(): number { return this.n; }
  avg(): number {
    if (this.n === 0) return 0;
    let s = 0;
    for (let i = 0; i < this.n; i++) s += this.ring[i]!;
    return s / this.n;
  }
  /** Nearest-rank 95th percentile of the stored window. */
  p95(): number {
    if (this.n === 0) return 0;
    const sc = this.scratch.subarray(0, this.n);
    sc.set(this.ring.subarray(0, this.n));
    sc.sort();
    return sc[Math.ceil(this.n * 0.95) - 1]!;
  }
}

/** Dev-only `?fps` overlay: DOM text refreshed every 20 frames. Returns its cleanup. */
export function attachFpsOverlay(stats: FrameStats): { update: () => void; dispose: () => void } {
  const el = document.createElement('div');
  Object.assign(el.style, { position: 'fixed', left: '4px', top: '4px', zIndex: '99999', font: '12px monospace', color: '#0f0', background: 'rgba(0,0,0,0.6)', padding: '2px 4px', pointerEvents: 'none' });
  document.body.append(el);
  let k = 0;
  return {
    update: () => {
      if (++k % 20 !== 0) return;
      const a = stats.avg();
      el.textContent = `${(a > 0 ? 1000 / a : 0).toFixed(0)} fps  avg ${a.toFixed(1)} ms  p95 ${stats.p95().toFixed(1)} ms`;
    },
    dispose: () => { el.remove(); },
  };
}
