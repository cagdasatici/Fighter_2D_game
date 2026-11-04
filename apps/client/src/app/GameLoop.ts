const FRAME_MS = 1000 / 60;

/** Owns the animation request and drops excess backlog after four simulation steps. */
export class GameLoop {
  private request: number | null = null;
  private previous: number | null = null;
  private accumulator = 0;
  constructor(private readonly tick: () => void, private readonly render: (alpha: number) => void) {}
  start(): void {
    if (this.request !== null) return;
    document.addEventListener('visibilitychange', this.resetClock);
    this.request = requestAnimationFrame(this.frame);
  }
  private resetClock = (): void => { this.previous = null; this.accumulator = 0; };
  private frame = (now: number): void => {
    const elapsed = this.previous === null ? 0 : Math.max(0, now - this.previous);
    this.previous = now;
    this.accumulator = Math.min(this.accumulator + elapsed, FRAME_MS * 4);
    let steps = 0;
    while (this.accumulator >= FRAME_MS && steps < 4) {
      this.tick();
      this.accumulator -= FRAME_MS;
      steps++;
    }
    this.render(this.accumulator / FRAME_MS);
    this.request = requestAnimationFrame(this.frame);
  };
  dispose(): void {
    if (this.request !== null) cancelAnimationFrame(this.request);
    this.request = null;
    document.removeEventListener('visibilitychange', this.resetClock);
    this.resetClock();
  }
}
