import { expect, type Page } from "@playwright/test";

export interface KbView { frame: number; phase: string; hp: [number, number]; comboHits: [number, number]; x: [number, number]; chars: [string, string] }

/** Read a plain snapshot of window.__kb.state (dev builds only). */
export async function kb(page: Page): Promise<KbView | null> {
  return await page.evaluate(() => {
    const k = (window as unknown as { __kb?: { state: { frame: number; phase: string; fighters: { hp: number; comboHits: number; x: number; char: string }[] } } }).__kb;
    if (!k) return null;
    const s = k.state, f = s.fighters;
    return { frame: s.frame, phase: s.phase, hp: [f[0]!.hp, f[1]!.hp], comboHits: [f[0]!.comboHits, f[1]!.comboHits], x: [f[0]!.x, f[1]!.x], chars: [f[0]!.char, f[1]!.char] };
  });
}

/** Count canvas pixels that differ from the first pixel (on a downscaled sample). */
export async function canvasVariety(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c) return 0;
    const t = document.createElement("canvas"); t.width = 64; t.height = 36;
    const g = t.getContext("2d")!; g.drawImage(c, 0, 0, 64, 36);
    const d = g.getImageData(0, 0, 64, 36).data;
    const colors = new Set<number>();
    for (let i = 0; i < d.length; i += 4) colors.add((d[i]! >> 4) << 8 | (d[i + 1]! >> 4) << 4 | (d[i + 2]! >> 4));
    return colors.size;
  });
}

export async function waitPhase(page: Page, phase: string, ms = 15000): Promise<void> {
  await expect.poll(async () => (await kb(page))?.phase, { timeout: ms }).toBe(phase);
}
