import { afterEach, expect, test } from "vitest";
import { Keyboard } from "../../apps/client/src/input/Keyboard.js";
import { DEFAULT_KEYS } from "../../apps/client/src/ui/Settings.js";
import { LP } from "../../packages/shared/src/input/buttons.js";

// S15: a key pressed and released between two ticks must still reach the next read, exactly once.
const handlers = new Map<string, (e: unknown) => void>();
const target = { addEventListener: (t: string, f: (e: unknown) => void) => handlers.set(t, f), removeEventListener: (t: string) => handlers.delete(t) };
const g = globalThis as Record<string, unknown>;
afterEach(() => { for (const n of ["window", "document", "HTMLInputElement", "HTMLSelectElement"]) delete g[n]; handlers.clear(); });

test("a sub-frame tap is latched for one read", () => {
  g["window"] = target; g["document"] = target; g["HTMLInputElement"] = class {}; g["HTMLSelectElement"] = class {};
  const k = new Keyboard(DEFAULT_KEYS, () => {});
  const ev = { code: DEFAULT_KEYS[0].LP, repeat: false, target: null, preventDefault: () => {} };
  handlers.get("keydown")!(ev); handlers.get("keyup")!(ev);
  expect(k.read()[0] & LP).toBe(LP);
  expect(k.read()[0] & LP).toBe(0);
  k.dispose();
});
