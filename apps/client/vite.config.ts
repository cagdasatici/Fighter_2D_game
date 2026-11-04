import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";

/** S14 (copied from battlegrounds WEB1): emits asset-manifest.json (precache list) and stamps the build id into sw.js. */
function offlineShell(): Plugin {
  let outDir = "dist";
  let buildId = "dev";
  return {
    name: "kb-offline-shell",
    apply: "build",
    configResolved(c) { outDir = join(c.root, c.build.outDir); },
    generateBundle(_o, bundle) {
      const assets = Object.keys(bundle).filter((n) => !n.endsWith(".map")).map((n) => "/" + n).sort();
      buildId = createHash("sha256").update(assets.join("\n")).digest("hex").slice(0, 12);
      this.emitFile({ type: "asset", fileName: "asset-manifest.json", source: JSON.stringify({ buildId, assets }) + "\n" });
    },
    closeBundle() {
      const f = join(outDir, "sw.js");
      writeFileSync(f, readFileSync(f, "utf8").replaceAll("__BUILD_ID__", buildId));
    },
  };
}

// Decision 0010: dev proxy so `pnpm dev:client` can play online against `pnpm dev:server` (default port 2567).
const target = `http://127.0.0.1:${process.env["KB_SERVER_PORT"] ?? "2567"}`;
export default defineConfig({
  server: {
    proxy: {
      "/api": { target, changeOrigin: false },
      "/matchmake": { target, changeOrigin: false },
      "/healthz": { target, changeOrigin: false },
      // Colyseus room sockets: ws://host/<processId>/<roomId>?... (ids are url-safe, never contain '.' or '@').
      "^/[A-Za-z0-9_-]{6,}/[A-Za-z0-9_-]{6,}(\\?.*)?$": { target, ws: true, changeOrigin: false },
    },
  },
  build: {
    target: "es2022", sourcemap: true,
    rollupOptions: { input: { main: join(import.meta.dirname, "index.html") } },
  },
  plugins: [offlineShell()],
});
