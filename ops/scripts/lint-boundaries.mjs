// Boundary + determinism lint (spec §2). Exit 1 and print file:line on any violation.
// KB_LINT_ROOT overrides the repo root (used by tests/unit/lint-boundaries.test.ts).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.env.KB_LINT_ROOT ?? new URL("../../", import.meta.url).pathname;
const files = (d) =>
  !existsSync(d) ? [] : readdirSync(d).flatMap((n) => {
    const p = join(d, n);
    if (n === "node_modules" || n === "dist" || n === "dist-types") return [];
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|mts|js|mjs)$/.test(p) ? [p] : [];
  });

const SHARED_SRC = join(root, "packages/shared/src");
const DETERMINISTIC_DIRS = ["sim", "input", "chars", "ai"].map((d) => join(SHARED_SRC, d) + sep);
const DETERMINISTIC_FILES = ["fixed.ts", "rng.ts"].map((f) => join(SHARED_SRC, f));
const BANNED_SIM = /Math\.(random|sin|cos|sqrt|pow|round|floor|ceil)|\bDate\b|performance\.|setTimeout|setInterval|\*\*|parseFloat|toFixed/;
const SHARED_IMPORT = /(from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["'](node:|[^"']*\bapps\/)/;
const DOM_REF = /\b(document|window)\b/;
const FOREIGN_IMPORT = /(from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["'][^"']*(battlegrounds_game|Archive)/;

const isComment = (line) => { const t = line.trimStart(); return t.startsWith("//") || line.startsWith(" *") || t.startsWith("*") || t.startsWith("/*"); };
let bad = 0;
const report = (rule, f, i, line) => { console.error(`${rule} ${relative(root, f)}:${i + 1}: ${line.trim()}`); bad++; };

for (const f of files(SHARED_SRC)) {
  const deterministic = DETERMINISTIC_DIRS.some((d) => f.startsWith(d)) || DETERMINISTIC_FILES.includes(f);
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (isComment(line)) return;
    if (SHARED_IMPORT.test(line)) report("SHARED_IMPORT", f, i, line);
    if (DOM_REF.test(line)) report("SHARED_DOM", f, i, line);
    if (deterministic && BANNED_SIM.test(line)) report("NONDETERMINISTIC", f, i, line);
  });
}
for (const f of [...files(join(root, "apps/client/src")), ...files(join(root, "packages"))]) {
  readFileSync(f, "utf8").split("\n").forEach((line, i) => {
    if (isComment(line)) return;
    if (FOREIGN_IMPORT.test(line)) report("FOREIGN_IMPORT", f, i, line);
  });
}
if (bad) { console.error(`boundaries: ${bad} violation(s)`); process.exit(1); }
console.log("boundaries ok");
