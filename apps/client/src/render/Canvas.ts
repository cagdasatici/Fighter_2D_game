export const WIDTH = 640, HEIGHT = 360, GROUND = 320;

export class Canvas {
  readonly ctx: CanvasRenderingContext2D;
  private scale = 1;
  constructor(readonly element: HTMLCanvasElement) {
    const ctx = element.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', this.resize);
  }
  private resize = (): void => {
    const fit = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    this.scale = Math.max(1, Math.floor(fit * window.devicePixelRatio));
    this.element.width = WIDTH * this.scale;
    this.element.height = HEIGHT * this.scale;
    Object.assign(this.element.style, {
      position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
      width: `${WIDTH * fit}px`, height: `${HEIGHT * fit}px`, display: 'block',
    });
  };
  begin(): CanvasRenderingContext2D {
    // Also handles moving the window between monitors with different pixel ratios.
    const fit = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    if (this.scale !== Math.max(1, Math.floor(fit * window.devicePixelRatio))) this.resize();
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    return this.ctx;
  }
  dispose(): void { window.removeEventListener('resize', this.resize); }
}
