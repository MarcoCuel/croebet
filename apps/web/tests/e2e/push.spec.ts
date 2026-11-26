import { test, expect } from "@playwright/test";

test("service worker de push é servido no escopo raiz e sem cache", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["service-worker-allowed"]).toBe("/");
  const body = await response.text();
  expect(body).toContain('addEventListener("push"');
  expect(body).toContain('addEventListener("notificationclick"');
});

test("service worker fica registrado no escopo raiz", async ({ page }) => {
  await page.goto("/");
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration("/")))).toBe(true);
});
