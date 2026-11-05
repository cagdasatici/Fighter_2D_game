import { invalidateLayers, setLayerScale } from './Layers.js';

export const WIDTH = 640, HEIGHT = 360, GROUND = 320;

/** Backing-store scale: fit * devicePixelRatio, rounded, clamped to 1..2 (decision 0014: cap 2 for iPad fill rate). */
export function backingScale(fit: number, dpr: number): number { return Math.min(2, Math.max(1, Math.round(fit * dpr))); }

export class Canvas {
  readonly ctx: CanvasRenderingContext2D;
  private scale = 1;
  private dprQuery: MediaQueryList | null = null;
  constructor(readonly element: HTMLCanvasElement) {
    const ctx = element.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', this.resize);
    this.watchDpr();
  }
  /** Re-arm the resolution query for the current devicePixelRatio (moving between monitors changes it). */
  private watchDpr(): void {
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    this.dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    this.dprQuery.addEventListener('change', this.onDprChange);
  }
  private onDprChange = (): void => { this.resize(); this.watchDpr(); };
  private resize = (): void => {
    const fit = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    const next = backingScale(fit, window.devicePixelRatio);
    if (next !== this.scale || this.element.width !== WIDTH * next) {
      this.scale = next;
      this.element.width = WIDTH * next; // resets context state
      this.element.height = HEIGHT * next;
      this.ctx.imageSmoothingEnabled = true;
      setLayerScale(next);
      invalidateLayers();
    }
    Object.assign(this.element.style, {
      position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
      width: `${WIDTH * fit}px`, height: `${HEIGHT * fit}px`, display: 'block',
    });
  };
  begin(): CanvasRenderingContext2D {
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    return this.ctx;
  }
  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.dprQuery?.removeEventListener('change', this.onDprChange);
    this.dprQuery = null;
  }
}
