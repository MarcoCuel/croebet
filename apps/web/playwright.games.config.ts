import { defineConfig } from "@playwright/test";
import base from "./playwright.pages.config";
export default defineConfig({
  ...base,
  testMatch: ["games.spec.ts", "flip7.spec.ts"],
  outputDir: "test-results/games",
  webServer: {
    command: "pnpm build && node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100", timeout: 180000, reuseExistingServer: false,
    env: { API_INTERNAL_URL: "http://127.0.0.1:3201", NEXT_DIST_DIR: ".next-e2e-games" },
  },
});
