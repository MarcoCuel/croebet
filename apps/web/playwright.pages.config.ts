import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Production build avoids sharing Next dev's lock with the user's running app.
export default defineConfig({
  ...base, testIgnore: [], testMatch: ["pages.spec.ts", "menus.spec.ts", "media.spec.ts", "rankings.spec.ts"],
  webServer: {
    command: "node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100", timeout: 60000, reuseExistingServer: false,
    env: { API_INTERNAL_URL: "http://127.0.0.1:3201", NEXT_DIST_DIR: ".next-e2e" },
  },
});
