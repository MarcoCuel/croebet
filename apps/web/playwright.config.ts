import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/media.spec.ts", "**/session-hydration.spec.ts", "**/profile.spec.ts", "**/wallet-history.spec.ts", "**/economy.spec.ts", "**/management.spec.ts", "**/pages.spec.ts", "**/menus.spec.ts", "**/admin-overview.spec.ts"],
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: "chrome",
      },
    },
  ],
  webServer: {
    env: { API_INTERNAL_URL: "http://127.0.0.1:3201", NEXT_DIST_DIR: ".next-e2e" },
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
