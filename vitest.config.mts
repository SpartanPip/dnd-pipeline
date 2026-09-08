import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // Our tests exercise the content/search libraries directly (no DOM
    // rendering), so plain Node avoids jsdom entirely. Switch a project to
    // "jsdom" locally if you add component-level tests later.
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
