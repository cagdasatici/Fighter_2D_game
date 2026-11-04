import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "@playwright/test";

// S15 (decision 0011): vite dev client (window.__kb hook is dev-only) + a dev game server with OPEN_JOIN for the two-tab test.
const SERVER_PORT = 25690;
const CLIENT_PORT = 5199;
const ORIGIN = `http://localhost:${CLIENT_PORT}`;
const dataDir = mkdtempSync(join(tmpdir(), "kb-browser-"));

export default defineConfig({
  testDir: "tests/browser", testMatch: "*.spec.ts", timeout: 60000, reporter: "list", workers: 1,
  use: { baseURL: ORIGIN, viewport: { width: 1280, height: 720 } },
  webServer: [
    {
      command: "pnpm --filter @kb/server exec tsx src/main.ts",
      url: `http://127.0.0.1:${SERVER_PORT}/healthz`, reuseExistingServer: false, timeout: 60000,
      env: { NODE_ENV: "development", PORT: String(SERVER_PORT), PUBLIC_ORIGIN: ORIGIN, OPEN_JOIN: "1", ADMIN_ENABLED: "0", DATA_DIR: dataDir },
    },
    {
      command: `pnpm --filter @kb/client exec vite --port ${CLIENT_PORT} --strictPort --host localhost`,
      url: ORIGIN, reuseExistingServer: false, timeout: 60000,
      env: { KB_SERVER_PORT: String(SERVER_PORT) },
    },
  ],
});
