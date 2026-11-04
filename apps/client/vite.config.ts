import { join } from "node:path";
import { defineConfig } from "vite";

// TODO: add the offline-shell plugin, admin.html input and sw.js from battlegrounds in the PWA slice (spec §14).
export default defineConfig({
  build: {
    target: "es2022", sourcemap: true,
    rollupOptions: { input: { main: join(import.meta.dirname, "index.html") } },
  },
});
