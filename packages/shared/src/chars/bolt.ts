import { box, DEFAULT_PHYSICS, hit, lh, move, normal, pair, proj, STD_NORMAL_IDS } from "./base.js";
import type { CharDef } from "./types.js";

export const BOLT: CharDef = {
  id: "bolt", name: "Bolt Brickley", hp: 1000, ...DEFAULT_PHYSICS,
  moves: [
    ...STD_NORMAL_IDS.filter((id) => id !== "5HP").map((id) => normal(id)),
    normal("5HP", { hit: { box: box(20, 64, 56, 24) } }),
    move({
      id: "6HP", kind: "command", name: "Hat Butt", input: { motion: "none", button: "HP", dir: 6, stance: "stand" },
      startup: 18, active: 3, recovery: 14, pose: "strong",
      hits: [hit({ frames: [19, 21], box: box(15, 70, 40, 30), damage: 60, chip: 6, hitstun: 16, blockstun: 12, level: "overhead" })],
    }),
    ...pair((v) => move({
      id: `rivetShot.${v}`, kind: "special", name: "Rivet Shot", input: { motion: "qcf", button: lh(v, "LP", "HP"), dir: null, stance: "stand" },
      startup: 12, active: 0, recovery: 30, pose: "cast",
      projectile: proj({ spawnFrame: 12, offset: { x: 50, y: 70 }, vx: lh(v, 450, 650), w: 20, h: 10, lifetime: 120, damage: 70, chip: 10, hitstun: 18, blockstun: 14, hitstop: 8, pushback: 1200, meterOnHit: 30, kind: "rivet" }),
    })),
    ...pair((v) => move({
      id: `jackhammerRise.${v}`, kind: "special", name: "Jackhammer Rise", input: { motion: "dp", button: lh(v, "LP", "HP"), dir: null, stance: "stand" },
      startup: 3, active: 12, recovery: 24, landingRecovery: 10, pose: "rise",
      invuln: [{ from: 1, to: lh(v, 6, 8), kind: "full" }],
      velocities: [{ frame: 3, vx: 150, vy: lh(v, 1500, 1800) }],
      airborneFrames: [3, 39],
      // "chip 15" in characters.md applied per hit (assumption, see test-results/S3.md).
      hits: [
        hit({ frames: [4, 6], box: box(10, 40, 40, 60), damage: 60, chip: 15, hitstun: 30 }),
        hit({ frames: [7, 15], box: box(5, 60, 40, 60), damage: lh(v, 50, 80), chip: 15, knockdown: true, launch: { vx: 200, vy: 1200 } }),
      ],
    })),
    move({
      id: "demolitionDrive", kind: "super", name: "Demolition Drive", input: { motion: "dqcf", button: "P", dir: null, stance: "stand" },
      startup: 4, active: 20, recovery: 30, pose: "demolition",
      velocities: [{ frame: 4, vx: 1100, vy: null }], invuln: [{ from: 1, to: 10, kind: "strike" }],
      hits: [hit({ frames: [5, 24], box: box(10, 30, 50, 70), damage: 50, chip: 15, blockstun: 20 })],
      lockOnHit: { hits: 4, interval: 6, damage: 50, finalDamage: 130, finalLaunch: { vx: 400, vy: 1500 } },
    }),
  ],
};
