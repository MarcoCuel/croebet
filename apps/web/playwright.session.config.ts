import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: ["session-hydration.spec.ts", "wallet-history.spec.ts", "economy.spec.ts", "management.spec.ts", "admin-overview.spec.ts"],
  outputDir: "test-results/session",
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    timeout: 120000,
    env: { API_INTERNAL_URL: "http://127.0.0.1:3201", NEXT_DIST_DIR: ".next-e2e-session" },
    reuseExistingServer: false,
  },
});
