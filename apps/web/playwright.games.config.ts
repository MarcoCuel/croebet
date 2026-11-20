import { defineConfig } from "@playwright/test";
import base from "./playwright.pages.config";
export default defineConfig({ ...base, testMatch: ["games.spec.ts", "flip7.spec.ts"] });
