import { cleanSocd } from '@kb/shared';
import { ACTIONS, ACTION_BITS, type KeyMap } from '../ui/Settings.js';
import type { InputSource } from './InputSource.js';

/** Code → bit maps for P1 and P2 built from the (rebindable, spec §12.1) key settings. */
export function buildMaps(keys: readonly [KeyMap, KeyMap]): [Record<string, number>, Record<string, number>] {
  const one = (k: KeyMap): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const a of ACTIONS) m[k[a]] = (m[k[a]] ?? 0) | ACTION_BITS[a];
    return m;
  };
  return [one(keys[0]), one(keys[1])];
}

export class Keyboard implements InputSource {
  private readonly held = new Set<string>();
  /** S15: keys pressed since the last read, so a tap released before the next tick still counts for one frame. */
  private readonly tapped = new Set<string>();
  private maps: [Record<string, number>, Record<string, number>];
  constructor(keys: readonly [KeyMap, KeyMap], private readonly toggleDebug: () => void, private readonly onPause: () => void = () => {}) {
    this.maps = buildMaps(keys);
    window.addEventListener('keydown', this.down);
    window.addEventListener('keyup', this.up);
    window.addEventListener('blur', this.clear);
    document.addEventListener('visibilitychange', this.clear);
  }
  setKeys(keys: readonly [KeyMap, KeyMap]): void { this.maps = buildMaps(keys); this.clear(); }
  private down = (e: KeyboardEvent): void => {
    if (e.code === 'F1') {
      e.preventDefault();
      if (!e.repeat && import.meta.env.DEV) this.toggleDebug();
      return;
    }
    if (e.code === 'Escape') { if (!e.repeat) this.onPause(); return; }
    if (this.maps.some(map => map[e.code] !== undefined)) {
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) e.preventDefault();
      this.held.add(e.code); this.tapped.add(e.code);
    }
  };
  private up = (e: KeyboardEvent): void => { this.held.delete(e.code); };
  private clear = (): void => { this.held.clear(); this.tapped.clear(); };
  read(): [number, number] {
    const read = (map: Record<string, number>): number => {
      let byte = 0;
      for (const code of this.held) byte |= map[code] ?? 0;
      for (const code of this.tapped) byte |= map[code] ?? 0;
      return cleanSocd(byte);
    };
    const out: [number, number] = [read(this.maps[0]), read(this.maps[1])];
    this.tapped.clear();
    return out;
  }
  dispose(): void {
    window.removeEventListener('keydown', this.down);
    window.removeEventListener('keyup', this.up);
    window.removeEventListener('blur', this.clear);
    document.removeEventListener('visibilitychange', this.clear);
    this.clear();
  }
}
