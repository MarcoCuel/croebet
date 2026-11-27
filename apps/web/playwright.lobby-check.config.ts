import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: ["games.spec.ts", "flip7.spec.ts"],
  outputDir: "test-results/lobby-check",
  projects: base.projects?.slice(0, 1),
});
