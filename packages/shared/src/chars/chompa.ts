import { box, DEFAULT_PHYSICS, hit, lh, move, normal, pair, proj, STD_NORMAL_IDS } from "./base.js";
import type { CharDef } from "./types.js";

export const CHOMPA: CharDef = {
  id: "chompa", name: "Chompa", hp: 1100, ...DEFAULT_PHYSICS,
  walkFwd: 280, walkBack: 220, jumpVy: 1500, jumpVx: 340, dashFwd: { frames: 20, speed: 800 }, pushWidth: 50,
  hurt: { stand: box(-26, 0, 52, 104), crouch: box(-28, 0, 56, 70), air: box(-24, 10, 48, 84) },
  moves: [
    ...STD_NORMAL_IDS.filter((id) => !["5LP", "5HP", "5HK", "2HK"].includes(id)).map((id) => normal(id)),
    normal("5LP", { pose: "bite", hit: { box: box(20, 70, 38, 18) } }),
    normal("5HP", { name: "Chomp", startup: 8, pose: "chomp", hit: { damage: 95, box: box(20, 60, 48, 30) } }),
    normal("5HK", { recovery: 22, pose: "tailWhip", hit: { box: box(10, 30, 70, 24) } }),
    normal("2HK", { pose: "tailSweep", hit: { box: box(10, 0, 80, 14) } }),
    move({
      id: "6HK", kind: "command", name: "Belly Bounce", input: { motion: "none", button: "HK", dir: 6, stance: "stand" },
      startup: 12, active: 4, recovery: 16, pose: "bellyBounce",
      hits: [hit({ frames: [13, 16], box: box(10, 30, 40, 50), damage: 70, chip: 7, pushback: 2600 })],
    }),
    ...pair((v) => move({
      id: `gulpGrab.${v}`, kind: "special", name: "Gulp Grab", input: { motion: "spin", button: lh(v, "LP", "HP"), dir: null, stance: "stand" },
      startup: 5, active: 2, recovery: 34, pose: "gulp", sfx: "gulp",
      // range in units (100 = 1 px), like THROW_RANGE.
      grab: { range: lh(v, 8000, 6500), damage: lh(v, 200, 240), throwVx: 900, throwVy: 1200 },
    })),
    ...pair((v) => move({
      id: `eggLob.${v}`, kind: "special", name: "Egg Lob", input: { motion: "qcb", button: lh(v, "LP", "HP"), dir: null, stance: "stand" },
      startup: 16, active: 0, recovery: 26, pose: "cast",
      // TODO(S3 gap): egg lifetime not in characters.md; provisional 120.
      projectile: proj({ spawnFrame: 16, offset: { x: 20, y: 90 }, vx: lh(v, 300, 520), vy: 1200, gravity: 70, w: 20, h: 24, lifetime: 120, damage: 80, chip: 10, knockdown: true, explodeOnGround: true, kind: "egg" }),
    })),
    move({
      // rolls, rebounds once off the wall, hits every 6 frames (max 6): sim/specials.ts (S6). launch applies to the 6th hit.
      id: "stampedeRoll", kind: "super", name: "Stampede Roll", input: { motion: "dqcf", button: "K", dir: null, stance: "stand" },
      startup: 6, active: 50, recovery: 30, pose: "ball",
      velocities: [{ frame: 6, vx: 1300, vy: null }], invuln: [{ from: 1, to: 12, kind: "strike" }],
      hits: [hit({ frames: [7, 56], box: box(-30, 0, 60, 60), damage: 55, chip: 10, launch: { vx: 500, vy: 1400 } })],
    }),
  ],
};
