import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = join(import.meta.dirname, "../../ops/scripts/lint-boundaries.mjs");
const dirs: string[] = [];
const makeRoot = (rel: string, body: string): string => {
  const root = mkdtempSync(join(tmpdir(), "kb-lint-"));
  dirs.push(root);
  const file = join(root, rel);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, body);
  return root;
};
const run = (root: string) => spawnSync(process.execPath, [script], { env: { ...process.env, KB_LINT_ROOT: root }, encoding: "utf8" });

afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

describe("lint-boundaries", () => {
  it("fails on Math.random in sim", () => {
    const r = run(makeRoot("packages/shared/src/sim/bad.ts", "export const x = Math.random();\n"));
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("sim/bad.ts:1");
  });
  it("passes clean sim code and ignores comments", () => {
    const r = run(makeRoot("packages/shared/src/sim/ok.ts", "// Math.random is banned\nexport const x = 1;\n"));
    expect(r.status).toBe(0);
  });
});
