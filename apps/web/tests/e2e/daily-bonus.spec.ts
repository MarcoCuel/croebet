import { expect, test } from "@playwright/test";
import type { DailyStatus } from "@croebet/shared";
import { startPublicApi } from "../public-api-fixture";

const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho", role: "user", avatarUrl: null, usernameChangeAvailableAt: null };
const initial = (): DailyStatus => ({ balance: 30, eligible: true, lastClaimAt: null, nextClaimAt: null, serverNow: "2026-11-20T12:00:00.000Z" });
let daily = initial();
let unavailable = false;
let claims = 0;
let closeApi: (() => Promise<void>) | undefined;

test.beforeAll(async () => {
  closeApi = await startPublicApi(request => request.headers.cookie?.includes("bonus-test") ? user : null, async (request, response) => {
    const path = request.url;
    if (path !== "/api/v1/rewards/daily" && path !== "/api/v1/rewards/daily/claim" && path !== "/api/v1/auth/csrf") return false;
    response.setHeader("content-type", "application/json");
    if (path === "/api/v1/auth/csrf") { response.end(JSON.stringify({ token: "fixture" })); return true; }
    if (unavailable) { response.statusCode = 503; response.end("{}"); return true; }
    if (path === "/api/v1/rewards/daily/claim") {
      claims++;
      daily = { balance: 40, eligible: false, lastClaimAt: daily.serverNow, nextClaimAt: "2026-11-21T12:00:00.000Z", serverNow: daily.serverNow };
    }
    response.end(JSON.stringify(daily));
    return true;
  });
});
test.afterAll(async () => { await closeApi?.(); });
test.beforeEach(async ({ context }) => {
  daily = initial(); unavailable = false; claims = 0;
  await context.addCookies([{ name: "croebet-session", value: "bonus-test", url: "http://127.0.0.1:3100" }]);
});

test("presente permite resgatar uma vez e desaparece após confirmação", async ({ page }) => {
  await page.goto("/");
  const header = page.locator("header");
  const gift = header.getByRole("button", { name: "Resgatar bônus diário", exact: true });
  await expect(gift).toBeVisible();
  await expect(gift).toHaveText("Bônus diário");
  await expect(gift.locator("xpath=following-sibling::button[1]")).toHaveAttribute("aria-label", "Notificações");
  await gift.click();
  await expect(gift).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Ver carteira" }).filter({ visible: true })).toContainText("40");
  expect(claims).toBe(1);
  await page.reload();
  await expect(gift).toHaveCount(0);
});

test("presente aparece quando o intervalo acaba sem recarregar", async ({ page }) => {
  daily = { ...initial(), eligible: false, lastClaimAt: "2026-11-19T12:00:02.000Z", nextClaimAt: "2026-11-20T12:00:02.000Z" };
  await page.clock.install({ time: new Date(daily.serverNow) });
  await page.goto("/");
  const gift = page.locator("header").getByRole("button", { name: "Resgatar bônus diário", exact: true });
  await expect(gift).toHaveCount(0);
  await page.clock.runFor(3000);
  await expect(gift).toBeVisible();
});

test("presente fica oculto sem status confirmado e para visitantes", async ({ page, context }) => {
  unavailable = true;
  await page.goto("/");
  await expect(page.locator("header").getByRole("button", { name: "Notificações", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resgatar bônus diário", exact: true })).toHaveCount(0);
  unavailable = false;
  await context.clearCookies();
  await page.reload();
  await expect(page.locator("header").getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resgatar bônus diário", exact: true })).toHaveCount(0);
});
