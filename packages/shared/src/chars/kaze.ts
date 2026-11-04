import { box, BASE_NORMALS, DEFAULT_PHYSICS, hit, lh, move, normal, pair, proj, STD_NORMAL_IDS } from "./base.js";
import type { CharDef, MoveDef } from "./types.js";

const LIGHTS = ["5LP", "2LP", "5LK", "2LK", "j.LP", "j.LK"];
/** Kaze: lights startup 3, 5LP/2LP recovery 6, −5 damage on every normal, 5HK startup 8. */
function kazeNormal(id: string): MoveDef {
  if (id === "throw") return normal(id);
  const base = BASE_NORMALS[id];
  const dmg = (base?.hits[0]?.damage ?? 0) - 5;
  const startup = LIGHTS.includes(id) ? 3 : id === "5HK" ? 8 : (base?.startup ?? 0);
  const recovery = id === "5LP" || id === "2LP" ? 6 : (base?.recovery ?? 0);
  return normal(id, { startup, recovery, ...(id === "5HK" ? { pose: "spinKick" } : {}), hit: { damage: dmg } });
}

export const KAZE: CharDef = {
  id: "kaze", name: "Kaze", hp: 900, ...DEFAULT_PHYSICS,
  walkFwd: 420, walkBack: 330, jumpVy: 1700, jumpVx: 460,
  dashFwd: { frames: 12, speed: 1200 }, dashBack: { frames: 16, speed: 1000, invuln: 10 }, airJumpMax: 1,
  moves: [
    ...STD_NORMAL_IDS.map(kazeNormal),
    move({
      id: "6LK", kind: "command", name: "Cartwheel Kick", input: { motion: "none", button: "LK", dir: 6, stance: "stand" },
      startup: 14, active: 4, recovery: 12, pose: "cartwheel",
      velocities: [{ frame: 1, vx: 500, vy: null }, { frame: 14, vx: 0, vy: null }],
      hits: [hit({ frames: [15, 18], box: box(10, 40, 40, 40), damage: 55, chip: 5, level: "overhead" })],
    }),
    ...pair((v) => move({
      // HP: second star 4 frames later at offset (40,60): sim/specials.ts (S6, `shurikenFan.H`).
      id: `shurikenFan.${v}`, kind: "special", name: "Shuriken Fan", input: { motion: "qcf", button: lh(v, "LP", "HP"), dir: null, stance: "stand" },
      startup: 10, active: 0, recovery: 28, pose: "throwStar",
      projectile: proj({ spawnFrame: 10, offset: { x: 40, y: 80 }, vx: 800, w: 16, h: 16, lifetime: 90, damage: 40, chip: 6, hitstun: 12, blockstun: 10, meterOnHit: 15, kind: "shuriken" }),
    })),
    ...pair((v) => move({
      // air version: recovery lasts until landing; 28 is the cap. Per-variant star count as ground version.
      id: `airShuriken.${v}`, kind: "special", name: "Air Shuriken", input: { motion: "qcf", button: lh(v, "LP", "HP"), dir: null, stance: "air" },
      startup: 10, active: 0, recovery: 28, landingRecovery: 4, pose: "throwStar",
      projectile: proj({ spawnFrame: 10, offset: { x: 40, y: 80 }, vx: 700, vy: -500, w: 16, h: 16, lifetime: 90, damage: 40, chip: 6, hitstun: 12, blockstun: 10, meterOnHit: 15, kind: "shuriken" }),
    })),
    ...pair((v) => move({
      // teleport at f10 (LK behind / HK in front), facing update f15: sim/specials.ts (S6).
      id: `smokeStep.${v}`, kind: "special", name: "Smoke Step", input: { motion: "dd", button: lh(v, "LK", "HK"), dir: null, stance: "stand" },
      startup: 4, active: 0, recovery: 14, pose: "smoke", invuln: [{ from: 1, to: 16, kind: "full" }],
    })),
    ...pair((v) => move({
      id: `risingCrane.${v}`, kind: "special", name: "Rising Crane", input: { motion: "dp", button: lh(v, "LK", "HK"), dir: null, stance: "stand" },
      startup: 4, active: 10, recovery: 22, landingRecovery: 10, pose: "crane",
      invuln: [{ from: 1, to: lh(v, 5, 7), kind: "full" }], velocities: [{ frame: 4, vx: 250, vy: 1600 }], airborneFrames: [4, 36],
      hits: [
        hit({ frames: [5, 7], box: box(10, 40, 40, 60), damage: 40, chip: 4 }),
        hit({ frames: [8, 14], box: box(10, 50, 40, 70), damage: lh(v, 60, 90), chip: lh(v, 6, 9), knockdown: true, launch: { vx: 250, vy: 1300 } }),
      ],
    })),
    move({
      id: "thousandShadows", kind: "super", name: "Thousand Shadows", input: { motion: "dqcf", button: "P", dir: null, stance: "stand" },
      startup: 3, active: 17, recovery: 34, pose: "shadowDash",
      velocities: [{ frame: 4, vx: 1600, vy: null }, { frame: 21, vx: 0, vy: null }], invuln: [{ from: 1, to: 6, kind: "full" }],
      hits: [hit({ frames: [4, 20], box: box(10, 20, 50, 90), damage: 30, chip: 3 })],
      lockOnHit: { hits: 8, interval: 6, damage: 30, finalDamage: 100, finalLaunch: { vx: 300, vy: 1600 } },
    }),
  ],
};
