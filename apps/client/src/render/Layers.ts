/**
 * Offscreen layer cache (decision 0014, slice PERF). Render-only.
 * `cacheLayer` paints a layer once at the current backing scale and returns the bitmap; later calls with the
 * same key return the same canvas until `invalidateLayers()` (scale change) bumps the generation.
 */
export interface LayerCanvas { width: number; height: number; getContext(id: '2d'): LayerContext | null }
export type LayerContext = CanvasRenderingContext2D;

let generation = 0;
let scale = 1;
let factory: (() => LayerCanvas | null) | null = null;
const layers = new Map<string, { gen: number; canvas: LayerCanvas }>();

function defaultFactory(): LayerCanvas | null {
  return typeof document === 'undefined' ? null : document.createElement('canvas');
}
/** Test hook: supply a fake canvas factory (the unit tests run without a DOM). */
export function setLayerCanvasFactory(f: (() => LayerCanvas | null) | null): void { factory = f; }

/** Backing scale the layers are painted at. Changing it invalidates every cached layer. */
export function setLayerScale(s: number): void {
  if (s === scale) return;
  scale = s;
  invalidateLayers();
}
export function getLayerScale(): number { return scale; }
/** Drop every cached layer; the next `cacheLayer` call repaints. */
export function invalidateLayers(): void { generation++; }
/** Number of live (current-generation) cached layers; used by tests. */
export function layerCount(): number {
  let n = 0;
  for (const l of layers.values()) if (l.gen === generation) n++;
  return n;
}

/** Current cached layer for `key`, or null if absent/invalidated. Lets hot callers skip building a paint closure. */
export function getLayer(key: string): LayerCanvas | null {
  const hit = layers.get(key);
  return hit && hit.gen === generation ? hit.canvas : null;
}

/**
 * Returns the cached `w`×`h` (logical px) layer for `key`, painting it once with `paint` (ctx is pre-scaled so
 * `paint` works in logical px). Returns null when no canvas can be created (no DOM).
 */
export function cacheLayer(key: string, w: number, h: number, paint: (g: LayerContext) => void): LayerCanvas | null {
  const hit = layers.get(key);
  if (hit && hit.gen === generation) return hit.canvas;
  const c = hit?.canvas ?? (factory ?? defaultFactory)();
  if (!c) return null;
  c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
  const g = c.getContext('2d');
  if (!g) return null;
  g.setTransform(scale, 0, 0, scale, 0, 0);
  paint(g);
  layers.set(key, { gen: generation, canvas: c });
  return c;
}

/** Cached stroked-text sprite (rendered at 2x for crisp scaling). Build at spawn time, never per frame. */
export interface TextStyle { font: string; fill: string; outline: string; outlineWidth: number; accent?: string; accentWidth?: number }
export interface TextSprite { canvas: LayerCanvas; w: number; h: number }
const textSprites = new Map<string, TextSprite | null>();
export function textSprite(text: string, st: TextStyle, w: number, h: number): TextSprite | null {
  const key = `${text}|${st.font}|${st.fill}|${st.outline}|${st.outlineWidth}|${st.accent ?? ''}`;
  if (textSprites.has(key)) return textSprites.get(key)!;
  const c = (factory ?? defaultFactory)();
  const g = c?.getContext('2d');
  let out: TextSprite | null = null;
  if (c && g) {
    c.width = w * 2; c.height = h * 2;
    g.setTransform(2, 0, 0, 2, w / 2 * 2, h / 2 * 2); // origin = sprite centre
    g.font = st.font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = st.outlineWidth; g.strokeStyle = st.outline; g.strokeText(text, 0, 0);
    g.fillStyle = st.fill; g.fillText(text, 0, 0);
    if (st.accent) { g.lineWidth = st.accentWidth ?? 2; g.strokeStyle = st.accent; g.strokeText(text, 0, 0); }
    out = { canvas: c, w, h };
  }
  textSprites.set(key, out);
  return out;
}

/**
 * Draw a horizontally scrolling parallax layer cached at width `640 + 1200 * f` (decision 0014). `paint` draws in
 * layer-local coords: origin x = `ox` (the layer's world origin), visible range [0, w]; y is in stage coords
 * (the layer covers y0..y0+h). `x` is the on-screen x of the origin (`320 - camX * f`) plus an optional sway.
 */
export function drawParallax(
  ctx: CanvasRenderingContext2D, key: string, f: number, y0: number, h: number, x: number,
  paint: (g: LayerContext, ox: number, w: number) => void,
): void {
  const w = 640 + 1200 * f;
  const c = getLayer(key) ?? cacheLayer(key, w, h, g => { g.translate(0, -y0); paint(g, w / 2, w); }); // closure only on a miss
  if (!c) { return; }
  // Snap to the backing grid so the blit stays sharp.
  ctx.drawImage(c as unknown as CanvasImageSource, Math.round((x - w / 2) * scale) / scale, y0, w, h);
}
