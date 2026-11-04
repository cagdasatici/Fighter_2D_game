import type { CharId } from '@kb/shared';

/** Core rig bones (spec §9.2). Every skin must style all of them. */
export type BoneId =
  | 'root' | 'torso' | 'head'
  | 'uArmF' | 'fArmF' | 'fistF' | 'uArmB' | 'fArmB' | 'fistB'
  | 'thighF' | 'shinF' | 'footF' | 'thighB' | 'shinB' | 'footB';
export const REQUIRED_BONES: readonly BoneId[] = [
  'root', 'torso', 'head', 'uArmF', 'fArmF', 'fistF', 'uArmB', 'fArmB', 'fistB',
  'thighF', 'shinF', 'footF', 'thighB', 'shinB', 'footB',
];
/** Optional render-only bones. */
export type ExtraBoneId = 'tail' | 'jaw' | 'scarf1' | 'scarf2' | 'scarf3' | 'scarf4';
export type AnyBone = BoneId | ExtraBoneId;

export interface BoneStyle { len: number; width: number; color: string }
export interface Seg { x0: number; y0: number; x1: number; y1: number; a: number } // a = absolute angle (deg)
export type Bones = Record<BoneId, Seg> & Partial<Record<ExtraBoneId, Seg>>;

/** Per-draw info handed to skin hooks. Coordinates are local, facing right, y down, origin at the feet. */
export interface DrawInfo { frame: number; meterFull: boolean; outline: string; jawOpen: number; mood: 'normal' | 'hurt' | 'fierce' }

export interface Skin {
  id: CharId;
  hipHeight: number;
  outline: string;       // 2 px outline colour
  accent: string;        // super-glow outline colour
  torsoLean: number;     // added to torso local angle (Chompa leans forward)
  bones: Record<BoneId, BoneStyle>;
  tail?: { len: number; w0: number; w1: number; color: string };
  scarf?: { segLen: number; width: number; color: string };
  /** Local-angle tweaks applied to specific poses (`pose` name) or to a move's active frames (`move:<id>`). */
  overrides?: Record<string, Partial<Record<AnyBone, number>>>;
  drawTorso(ctx: CanvasRenderingContext2D, b: Bones, info: DrawInfo): void;
  drawHead(ctx: CanvasRenderingContext2D, b: Bones, info: DrawInfo): void;
  drawBack?(ctx: CanvasRenderingContext2D, b: Bones, info: DrawInfo): void;
  drawFront?(ctx: CanvasRenderingContext2D, b: Bones, info: DrawInfo): void;
  drawFist?(ctx: CanvasRenderingContext2D, s: Seg, back: boolean, info: DrawInfo): void;
  drawFoot?(ctx: CanvasRenderingContext2D, s: Seg, back: boolean, info: DrawInfo): void;
}
