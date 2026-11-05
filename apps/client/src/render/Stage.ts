import type { MatchState } from '@kb/shared';
import { GROUND } from './Canvas.js';
import { cacheLayer, getLayer } from './Layers.js';
import { drawBamboo } from './stages/bamboo.js';
import { drawRooftop } from './stages/rooftop.js';
import { drawVolcano } from './stages/volcano.js';

/** Parallax view handed to stage painters. `t` is a render tick counter (decoration only, never sim). */
export interface StageView { camX: number; camY: number; t: number }
export const PARALLAX = [0.2, 0.5, 1.0] as const;
/** Screen x offset for a layer with parallax factor `f`. */
export const layerX = (v: StageView, f: number): number => 320 - v.camX * f;

const gradCache = new WeakMap<CanvasRenderingContext2D, Map<string, CanvasGradient>>();
/**
 * Memoised gradient per context + key. Gradients live in user space, so painters translate to a fixed origin
 * before filling with a cached one; this keeps the per-frame stage draw allocation-free.
 */
export function cachedGrad(ctx: CanvasRenderingContext2D, key: string, make: () => CanvasGradient): CanvasGradient {
  let m = gradCache.get(ctx);
  if (!m) { m = new Map(); gradCache.set(ctx, m); }
  let g = m.get(key);
  if (!g) { g = make(); m.set(key, g); }
  return g;
}
/** Vertical gradient with evenly spaced stops (cached). */
export function vgrad(ctx: CanvasRenderingContext2D, top: string, bottom: string, y0 = 0, y1 = GROUND, mid?: string): CanvasGradient {
  return cachedGrad(ctx, `v${top}${bottom}${y0}${y1}${mid ?? ''}`, () => {
    const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top);
    if (mid) g.addColorStop(0.5, mid);
    g.addColorStop(1, bottom); return g;
  });
}
const spriteCache = new Map<string, HTMLCanvasElement | null>();
/** Pre-render a small canvas once (keyed) and reuse it; drawing a cached bitmap is far cheaper than filling large gradients per frame. */
function sprite(key: string, w: number, h: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement | null {
  if (spriteCache.has(key)) return spriteCache.get(key)!;
  let c: HTMLCanvasElement | null = null;
  if (typeof document !== 'undefined') {
    c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    if (g) paint(g); else c = null;
  }
  spriteCache.set(key, c);
  return c;
}
/** Radial glow of radius `r` centred at (x, y), drawn from a cached 64 px sprite. */
export function glowAt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, inner: string, outer: string): void {
  const sp = sprite(`g${inner}${outer}`, 64, 64, g => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  if (sp) ctx.drawImage(sp, x - r, y - r, r * 2, r * 2);
}
/** Opaque or transparent full-width (640 px) layer painted once; drawn at stage y `y0`. */
export function drawStatic(ctx: CanvasRenderingContext2D, key: string, y0: number, h: number, paint: (g: CanvasRenderingContext2D) => void): void {
  const c = getLayer(key) ?? cacheLayer(key, 640, h, g => { g.translate(0, -y0); paint(g); });
  if (c) ctx.drawImage(c as unknown as CanvasImageSource, 0, y0, 640, h);
}
const PAINTERS: Record<MatchState['stage'], (ctx: CanvasRenderingContext2D, v: StageView) => void> = {
  rooftop: drawRooftop, bamboo: drawBamboo, volcano: drawVolcano,
};

/** Spec §9.5: background gradient, 3 parallax layers and the floor band (y 320-360). */
export function drawStage(ctx: CanvasRenderingContext2D, stage: MatchState['stage'], v: StageView): void {
  ctx.save();
  ctx.translate(0, v.camY);
  PAINTERS[stage](ctx, v);
  ctx.restore();
  // No full-screen vignette pass: measured as the main fill cost under CPU throttling (decision 0012).
}
