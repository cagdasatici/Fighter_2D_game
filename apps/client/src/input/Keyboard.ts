import { UP, DOWN, LEFT, RIGHT, LP, HP, LK, HK, cleanSocd } from '@kb/shared';
import type { InputSource } from './InputSource.js';

const MAPS: [Record<string, number>, Record<string, number>] = [
  { KeyW: UP, KeyS: DOWN, KeyA: LEFT, KeyD: RIGHT, KeyU: LP, KeyI: HP, KeyJ: LK, KeyK: HK },
  { ArrowUp: UP, ArrowDown: DOWN, ArrowLeft: LEFT, ArrowRight: RIGHT, Numpad4: LP, Numpad5: HP, Numpad1: LK, Numpad2: HK },
];

export class Keyboard implements InputSource {
  private readonly held = new Set<string>();
  constructor(private readonly toggleDebug: () => void) {
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.clear);
  }
  private down = (e: KeyboardEvent): void => {
    if (e.code === 'F1') {
      e.preventDefault();
      if (!e.repeat) this.toggleDebug();
      return;
    }
    if (MAPS.some(map => map[e.code] !== undefined)) {
      e.preventDefault();
      this.held.add(e.code);
    }
  };
  private up = (e: KeyboardEvent): void => {
    if (MAPS.some(map => map[e.code] !== undefined)) e.preventDefault();
    this.held.delete(e.code);
  };
  private clear = (): void => { this.held.clear(); };
  read(): [number, number] {
    const read = (map: Record<string, number>): number => {
      let byte = 0;
      for (const code of this.held) byte |= map[code] ?? 0;
      return cleanSocd(byte);
    };
    return [read(MAPS[0]), read(MAPS[1])];
  }
  dispose(): void {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('visibilitychange', this.clear);
    this.clear();
  }
}
