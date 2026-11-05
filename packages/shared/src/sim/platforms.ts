import type { StageId } from "./types.js";

/** One-way platform in sim units (1 px = 100). A fighter lands on it only when falling through `y` from above. */
export interface Platform { x0: number; x1: number; y: number }

// Heights derived from the lowest neutral-jump apex across CHARS (chompa, jumpVy 1500 -> apex 11760):
// LOW = floor(11760 * 0.55 / 100) * 100, HIGH = floor(11760 * 1.05 / 100) * 100. Hardcoded on purpose;
// tests/unit/platforms.test.ts re-derives them from a sim run and fails if they drift.
export const PLATFORM_MIN_APEX = 11760;
export const PLATFORM_LOW = 6400;
export const PLATFORM_HIGH = 12300;

/** Ordered highest first (landing checks the first match). Index = `Fighter.platform`. */
const LAYOUT: readonly Platform[] = [
  { x0: -9000, x1: 9000, y: PLATFORM_HIGH },
  { x0: -34000, x1: -16000, y: PLATFORM_LOW },
  { x0: 16000, x1: 34000, y: PLATFORM_LOW },
];
export const PLATFORMS: Record<StageId, readonly Platform[]> = {
  rooftop: LAYOUT, bamboo: LAYOUT, volcano: LAYOUT,
};
