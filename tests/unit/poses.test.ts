import { describe, expect, test } from "vitest";
import { CHARS } from "../../packages/shared/src/index.js";
import { solveBones } from "../../apps/client/src/render/Puppet.js";
import { getPose, POSES, windOf } from "../../apps/client/src/render/poses.js";
import { SKINS } from "../../apps/client/src/render/Gallery.js";
import { REQUIRED_BONES } from "../../apps/client/src/render/skins/types.js";

describe("S9 puppet rig", () => {
  test("idle: torso end is above the root for every skin", () => {
    for (const skin of Object.values(SKINS)) {
      const b = solveBones(skin, getPose("idle"), 1);
      expect(b.torso.y1).toBeLessThan(b.root.y0);
    }
  });
  test("jab: front fist is in front of the shoulder for both facings", () => {
    const skin = SKINS.bolt;
    const r = solveBones(skin, getPose("jab"), 1), l = solveBones(skin, getPose("jab"), -1);
    expect(r.fistF.x0).toBeGreaterThan(r.uArmF.x0);
    expect(l.fistF.x0).toBeLessThan(l.uArmF.x0);
  });
  test("every pose used by any MoveDef (and its wind key) exists", () => {
    const missing: string[] = [];
    for (const c of Object.values(CHARS)) for (const m of c.moves) {
      if (!POSES[m.pose]) missing.push(`${c.id}:${m.id}:${m.pose}`);
      if (!POSES[windOf(m.pose)]) missing.push(`${c.id}:${m.id}:wind`);
    }
    expect(missing).toEqual([]);
  });
  test("every skin defines all required bones", () => {
    for (const skin of Object.values(SKINS)) for (const bone of REQUIRED_BONES) {
      expect(skin.bones[bone], `${skin.id}.${bone}`).toBeDefined();
      expect(skin.bones[bone].color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
