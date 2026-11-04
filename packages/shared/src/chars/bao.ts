import { box, DEFAULT_PHYSICS, hit, lh, move, normal, pair, proj, STD_NORMAL_IDS } from "./base.js";
import type { CharDef } from "./types.js";

export const BAO: CharDef = {
  id: "bao", name: "Bao", hp: 1100, ...DEFAULT_PHYSICS,
  walkFwd: 300, walkBack: 250, jumpVy: 1550, jumpVx: 340, pushWidth: 52,
  hurt: { stand: box(-28, 0, 56, 108), crouch: box(-30, 0, 60, 72), air: box(-26, 10, 52, 86) },
  moves: [
    ...STD_NORMAL_IDS.filter((id) => !["5HP", "2HP", "5HK"].includes(id)).map((id) => normal(id)),
    normal("5HP", { startup: 8, pose: "palm", hit: { damage: 90, pushback: 2200 } }),
    normal("2HP", { pose: "bellyBump", hit: { box: box(0, 40, 50, 60) } }),
    normal("5HK", { startup: 11, hit: { damage: 95 } }),
    move({
      id: "3HP", kind: "command", name: "Belly Bounce Down", input: { motion: "none", button: "HP", dir: 3, stance: "crouch" },
      startup: 16, active: 3, recovery: 16, landingRecovery: 0, pose: "hop",
      velocities: [{ frame: 1, vx: 0, vy: 900 }], airborneFrames: [1, 14],
      hits: [hit({ frames: [17, 19], box: box(0, 0, 60, 40), damage: 70, chip: 7, level: "overhead" })],
    }),
    ...pair((v) => {
      const s = lh(v, 13, 16);
      return move({
        id: `jadePalm.${v}`, kind: "special", name: "Jade Palm", input: { motion: "qcf", button: lh(v, "LP", "HP"), dir: null, stance: "stand" },
        startup: s, active: 4, recovery: 24, pose: "palm",
        hits: [hit({ frames: [s + 1, s + 4], box: lh(v, box(30, 50, 70, 40), box(30, 45, 100, 50)), damage: lh(v, 100, 130), chip: 15, hitstun: 22, blockstun: 16, pushback: 2500, knockdown: v === "H" })],
      });
    }),
    ...pair((v) => move({
      id: `rollingBun.${v}`, kind: "special", name: "Rolling Bun", input: { motion: "charge", button: lh(v, "LP", "HP"), dir: null, stance: "stand" },
      startup: 8, active: 30, recovery: 16, pose: "spin",
      velocities: [{ frame: 8, vx: lh(v, 900, 1200), vy: null }, { frame: 39, vx: 0, vy: null }],
      invuln: [{ from: 1, to: 38, kind: "projectile" }],
      hits: [hit({ frames: [9, 38], box: box(-20, 0, 60, 60), damage: lh(v, 90, 110), chip: lh(v, 9, 11), knockdown: true })],
    })),
    ...pair((v) => move({
      // LK = high counter (doesn't parry lows), HK = low counter (doesn't parry overheads).
      id: `bambooCounter.${v}`, kind: "special", name: "Bamboo Counter", input: { motion: "qcb", button: lh(v, "LK", "HK"), dir: null, stance: "stand" },
      startup: 3, active: 18, recovery: 22, pose: "counterStance",
      counter: { from: 4, to: 21, damage: 130, levels: lh(v, ["mid", "overhead"], ["mid", "low"]) },
    })),
    move({
      id: "dragonDumpling", kind: "super", name: "Dragon Dumpling", input: { motion: "dqcf", button: "P", dir: null, stance: "stand" },
      startup: 30, active: 0, recovery: 34, heal: 80, pose: "dumpling",
      invuln: [{ from: 1, to: 30, kind: "strike" }],
      // TODO(S3 gap): jadeDragon spawn offset not in characters.md; provisional (60,60).
      projectile: proj({ spawnFrame: 30, offset: { x: 60, y: 60 }, vx: 900, w: 90, h: 70, lifetime: 90, hits: 5, hitInterval: 4, damage: 50, chip: 10, blockstun: 20, knockdown: true, kind: "jadeDragon" }),
    }),
  ],
};
