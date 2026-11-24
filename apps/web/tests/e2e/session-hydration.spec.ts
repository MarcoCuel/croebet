import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

// Run with --config playwright.session.config.ts so server-side requests use this API.
const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho Público", role: "user", avatarUrl: null, usernameChangeAvailableAt: null };
let api: Server;
test.beforeAll(async () => {
  api = createServer((request, response) => {
    const cookie = request.headers.cookie ?? "";
    response.setHeader("content-type", "application/json");
    response.setHeader("cache-control", "no-store");
    response.statusCode = cookie.includes("unavailable") ? 503 : 200;
    response.end(JSON.stringify({ user: cookie.includes("valid-session") ? user : null }));
  });
  await new Promise<void>((resolve, reject) => { api.once("error", reject); api.listen(3201, "127.0.0.1", resolve); });
});
test.afterAll(async () => {
  if (!api?.listening) return;
  api.closeAllConnections();
  await new Promise<void>((resolve, reject) => api.close(error => error ? reject(error) : resolve()));
});

test.describe("HTML inicial", () => {
  test.use({ javaScriptEnabled: false });
    for (const token of ["valid-session", "expired", undefined]) {
      test(`HTML inicial já reflete a sessão ${token ?? "ausente"}, sem JavaScript`, async ({ page, context }) => {
        if (token) await context.addCookies([{ name: "croebet-session", value: token, url: "http://127.0.0.1:3100" }]);
        for (let attempt = 0; attempt < 2; attempt++) {
          if (attempt === 0) await page.goto("/");
        else await page.reload();
          if (token === "valid-session") {
            await expect(page.locator("header").getByRole("button", { name: "Conta de Tonho Público" })).toBeVisible();
            await expect(page.getByRole("button", { name: "Entrar", exact: true })).toHaveCount(0);
          } else {
            await expect(page.locator("header").getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
            await expect(page.getByRole("button", { name: "Conta de Tonho Público" })).toHaveCount(0);
          }
        }
      });
    }

});

test("falha na API mantém skeleton até confirmação no navegador", async ({ page, context }) => {
  await context.addCookies([{ name: "croebet-session", value: "unavailable", url: "http://127.0.0.1:3100" }]);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/v1/me", async route => { await gate; await route.fulfill({ json: { user } }); });
  await page.goto("/");
  await expect(page.locator("header").getByRole("status", { name: "Carregando conta" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toHaveCount(0);
  release();
  await expect(page.locator("header").getByRole("button", { name: "Conta de Tonho Público" })).toBeVisible();
  await expect(page.getByRole("status", { name: "Carregando conta" })).toHaveCount(0);
});
