import { box, DEFAULT_PHYSICS, hit, lh, move, normal, pair, proj, STD_NORMAL_IDS } from "./base.js";
import type { CharDef } from "./types.js";

const reach = (id: string, x: number, y: number, w: number, h: number, recovery: number) =>
  normal(id, { recovery, hit: { box: box(x, y, w + 12, h) } });

export const VOLT: CharDef = {
  id: "volt", name: "Volt Vance", hp: 950, ...DEFAULT_PHYSICS,
  walkFwd: 320, walkBack: 300, jumpVy: 1750, jumpVx: 360,
  hurt: { ...DEFAULT_PHYSICS.hurt, stand: box(-20, 0, 40, 124), crouch: box(-22, 0, 44, 76) },
  moves: [
    ...STD_NORMAL_IDS.filter((id) => !["5HP", "5HK", "2HK", "j.HK"].includes(id)).map((id) => normal(id)),
    reach("5HP", 20, 66, 52, 22, 20),
    reach("5HK", 20, 58, 60, 22, 22),
    reach("2HK", 20, 0, 70, 14, 24),
    normal("j.HK", { active: 8, gravityScale: 50 }),
    move({
      id: "3LK", kind: "command", name: "Shock Toe", input: { motion: "none", button: "LK", dir: 3, stance: "crouch" },
      startup: 8, active: 6, recovery: 18, cancelInto: ["special", "super"], pose: "slide",
      velocities: [{ frame: 1, vx: 700, vy: null }, { frame: 14, vx: 0, vy: null }],
      hits: [hit({ frames: [9, 14], box: box(25, 0, 60, 14), damage: 50, chip: 5, level: "low" })],
    }),
    ...pair((v) => move({
      id: `staticSpark.${v}`, kind: "special", name: "Static Spark", input: { motion: "qcf", button: lh(v, "LP", "HP"), dir: null, stance: "stand" },
      startup: 14, active: 0, recovery: 28, pose: "cast",
      projectile: proj({ spawnFrame: 14, offset: { x: 45, y: 70 }, vx: lh(v, 250, 420), w: 26, h: 26, lifetime: 180, hits: 2, hitInterval: 10, damage: 60, chip: 10, hitstun: 16, blockstun: 12, pushback: 900, meterOnHit: 25, kind: "spark" }),
    })),
    ...pair((v) => move({
      id: `liveWireHop.${v}`, kind: "special", name: "Live Wire Hop", input: { motion: "dp", button: lh(v, "LK", "HK"), dir: null, stance: "stand" },
      startup: 5, active: 18, recovery: 20, landingRecovery: 12, pose: "rise",
      invuln: [{ from: 1, to: 7, kind: "strike" }], velocities: [{ frame: 5, vx: 100, vy: 1500 }], airborneFrames: [5, 43],
      hits: [6, 10, 14, 18].map((f, i) => hit({
        frames: [f, f + 3], box: box(0, 40, 45, 70), damage: 30, chip: 3,
        ...(i === 3 ? { knockdown: true, launch: { vx: 150, vy: 1000 } } : {}),
      })),
    })),
    move({
      // overload spawns 5 columns at f10/18/26/34/42, x = 80/180/280/380/480 px: multi-spawn in sim/specials.ts (S6).
      id: "overload", kind: "super", name: "Overload", input: { motion: "dqcf", button: "P", dir: null, stance: "stand" },
      startup: 10, active: 0, recovery: 40, pose: "overload",
      // y 180 = centre of a 360 px column standing on the ground (w/h are centred).
      projectile: proj({ spawnFrame: 10, offset: { x: 80, y: 180 }, vx: 0, w: 40, h: 360, lifetime: 8, damage: 70, chip: 12, hitstun: 30, blockstun: 18, kind: "lightningColumn" }),
    }),
  ],
};
