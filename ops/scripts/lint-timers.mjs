// Forbids setTimeout/setInterval in the deterministic sim and in server rooms (AGENTS.md).
// KB_LINT_ROOT overrides the repo root (used by tests).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.env.KB_LINT_ROOT ?? new URL("../../", import.meta.url).pathname;
const dirs = ["packages/shared/src/sim", "apps/server/src/sim", "apps/server/src/rooms"];
const files = (d) =>
  readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|mjs)$/.test(p) ? [p] : [];
  });
let bad = 0;
for (const dir of dirs) {
  const abs = join(root, dir);
  if (!existsSync(abs)) continue;
  for (const f of files(abs)) {
    readFileSync(f, "utf8").split("\n").forEach((line, i) => {
      if (/\b(setTimeout|setInterval)\b/.test(line)) { console.error(`TIMER ${f}:${i + 1}: ${line.trim()}`); bad++; }
    });
  }
}
if (bad) process.exit(1);
console.log("timers ok");
