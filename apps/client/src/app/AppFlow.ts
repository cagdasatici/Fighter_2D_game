import { cloneState, createMatch, step, type InputByte, type MatchState } from '@kb/shared';
import { Keyboard } from '../input/Keyboard.js';
import { Canvas } from '../render/Canvas.js';
import { Camera } from '../render/Camera.js';
import { drawDebug } from '../render/DebugDraw.js';
import { GameLoop } from './GameLoop.js';

declare global {
  interface Window { __kb?: { state: MatchState; step: (inputs?: [InputByte, InputByte]) => void } }
}

/** S8 enters local 2P directly; menu routing is added by S11. */
export class AppFlow {
  readonly state = createMatch({ chars: ['bolt', 'volt'], stage: 'rooftop', seed: 1 });
  private previous = cloneState(this.state);
  private readonly canvas: Canvas;
  private readonly camera = new Camera();
  private readonly keyboard: Keyboard;
  private readonly loop: GameLoop;
  private boxes = true;
  constructor(element: HTMLCanvasElement) {
    this.canvas = new Canvas(element);
    this.keyboard = new Keyboard(() => { this.boxes = !this.boxes; });
    this.loop = new GameLoop(() => this.advance(this.keyboard.read()), alpha => {
      drawDebug(this.canvas.begin(), this.state, this.previous, alpha, this.camera, this.boxes);
    });
    if (import.meta.env.DEV) window.__kb = { state: this.state, step: (inputs = [0, 0]) => this.advance(inputs) };
    this.loop.start();
  }
  private advance(inputs: [InputByte, InputByte]): void {
    this.previous = cloneState(this.state);
    step(this.state, inputs);
    this.camera.update(this.state);
  }
  dispose(): void {
    this.loop.dispose(); this.keyboard.dispose(); this.canvas.dispose();
    if (import.meta.env.DEV && window.__kb?.state === this.state) delete window.__kb;
  }
}
