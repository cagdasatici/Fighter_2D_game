import { FrameStats } from '../render/FrameStats.js';

const FRAME_MS = 1000 / 60;
/** `lowFx` turns on after this many consecutive frames slower than SLOW_FRAME_MS (decision 0014). */
export const SLOW_FRAMES_TO_LOWFX = 3, SLOW_FRAME_MS = 20;

/** Owns the animation request and drops excess backlog after four simulation steps. */
export class GameLoop {
  private request: number | null = null;
  private previous: number | null = null;
  private accumulator = 0;
  /** Frame-interval ring buffer (dev overlay + low-effects detection). */
  readonly stats = new FrameStats();
  /** True after 3 consecutive frames over 20 ms; FX halves its particle cap and skips trails. Reset on scene change. */
  lowFx = false;
  private slowRun = 0;
  constructor(private readonly tick: () => void, private readonly render: (alpha: number) => void, private readonly onFrame: (() => void) | null = null) {}
  /** Forget slow-frame history (call on scene change). */
  resetPerf(): void { this.lowFx = false; this.slowRun = 0; }
  start(): void {
    if (this.request !== null) return;
    document.addEventListener('visibilitychange', this.resetClock);
    this.request = requestAnimationFrame(this.frame);
  }
  private resetClock = (): void => { this.previous = null; this.accumulator = 0; this.slowRun = 0; };
  private frame = (now: number): void => {
    const elapsed = this.previous === null ? 0 : Math.max(0, now - this.previous);
    if (this.previous !== null) {
      this.stats.push(elapsed);
      if (elapsed > SLOW_FRAME_MS) { if (++this.slowRun >= SLOW_FRAMES_TO_LOWFX) this.lowFx = true; } else this.slowRun = 0;
    }
    this.previous = now;
    this.accumulator = Math.min(this.accumulator + elapsed, FRAME_MS * 4);
    let steps = 0;
    while (this.accumulator >= FRAME_MS && steps < 4) {
      this.tick();
      this.accumulator -= FRAME_MS;
      steps++;
    }
    this.render(this.accumulator / FRAME_MS);
    this.onFrame?.();
    this.request = requestAnimationFrame(this.frame);
  };
  dispose(): void {
    if (this.request !== null) cancelAnimationFrame(this.request);
    this.request = null;
    document.removeEventListener('visibilitychange', this.resetClock);
    this.resetClock();
  }
}
