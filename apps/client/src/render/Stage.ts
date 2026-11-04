import type { MatchState } from '@kb/shared';
import { GROUND } from './Canvas.js';
import { drawBamboo } from './stages/bamboo.js';
import { drawRooftop } from './stages/rooftop.js';
import { drawVolcano } from './stages/volcano.js';

/** Parallax view handed to stage painters. `t` is a render tick counter (decoration only, never sim). */
export interface StageView { camX: number; camY: number; t: number }
export const PARALLAX = [0.2, 0.5, 1.0] as const;
/** Screen x offset for a layer with parallax factor `f`. */
export const layerX = (v: StageView, f: number): number => 320 - v.camX * f;

export function vgrad(ctx: CanvasRenderingContext2D, top: string, bottom: string, y0 = 0, y1 = GROUND): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, top); g.addColorStop(1, bottom); return g;
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
}
