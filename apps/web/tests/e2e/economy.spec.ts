import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho", role: "user" };
const economy = { initialBalance: 30, dailyReward: 10, dailyResetTimeZone: 'America/Sao_Paulo', suggestedBets: [1, 5, 10, 50], defaultBet: 5 };
const initial = () => ({ balance: 30, lastClaimAt: null as string | null, nextClaimAt: null as string | null, eligible: true, serverNow: new Date().toISOString() });
let daily = initial();
let api: Server;
const game = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5c", slug: "flip7", name: "Flip 7", enabled: true, imageUrl: null, version: 1 };
test.beforeAll(async () => {
  api = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/api/v1/me/wallet") {
      response.end(JSON.stringify({ balance: daily.balance })); return;
    }
    if (request.url?.startsWith("/api/v1/me/transactions")) {
      response.end(JSON.stringify({ items: [], hasMore: false })); return;
    }
    if (request.url === "/api/v1/games" || request.url === "/api/v1/games/flip7") {
      response.end(JSON.stringify(request.url === "/api/v1/games" ? { items: [game] } : game));
      return;
    }
    response.end(JSON.stringify(request.url === "/api/v1/economy" ? economy : request.url === "/api/v1/rewards/daily" ? daily : { user }));
  });
  await new Promise<void>((resolve, reject) => { api.once("error", reject); api.listen(3201, "127.0.0.1", resolve); });
});
test.afterAll(async () => { if (api?.listening) await new Promise<void>(resolve => api.close(() => resolve())); });
test.beforeEach(async ({ context, page }) => {
  daily = initial();
  await context.addCookies([{ name: "croebet-session", value: "economy-test", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/me", route => route.fulfill({ json: { user } }));
  await page.route("**/api/v1/economy", route => route.fulfill({ json: economy }));
  await page.route("**/api/v1/rewards/daily", route => route.fulfill({ json: daily }));
});
test("saldo e regra do resgate já vêm no HTML inicial", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await context.addCookies([{ name: "croebet-session", value: "economy-test", url: "http://127.0.0.1:3100" }]);
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByText("10 Croins por dia. Renova à meia-noite de São Paulo.", { exact: true })).toBeVisible();
  await expect(page.locator("header [aria-live=polite]").first()).toContainText("30");
  await context.close();
});
test("resgate com saldo 30 credita 10 e persiste o intervalo após reload", async ({ page }) => {
  await page.route("**/api/v1/auth/csrf", route => route.fulfill({ json: { token: "fixture" } }));
  let claims = 0;
  await page.route("**/api/v1/rewards/daily/claim", async route => {
    claims++;
    expect(route.request().postDataJSON()).toEqual({ requestId: expect.any(String) });
    const now = new Date('2026-11-19T01:00:00Z'); // 22h em São Paulo
    daily = { balance: 40, eligible: false, lastClaimAt: now.toISOString(), nextClaimAt: '2026-11-19T03:00:00.000Z', serverNow: now.toISOString() };
    await route.fulfill({ json: daily });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Resgatar", exact: true }).click();
  await expect(page.locator("header [aria-live=polite]").first()).toContainText("40");
  await expect(page.getByRole("button", { name: "Aguarde o próximo resgate" })).toBeDisabled();
  await page.reload();
  await expect(page.getByText(/Próximo resgate em/)).toBeVisible();
  expect(claims).toBe(1);
});
test("Flip 7 usa valor padrão e sugestões da API sem debitar saldo local", async ({ page }) => {
  await page.goto("/jogos/flip7");
  await page.getByRole("switch", { name: "Jogar com Croins" }).check();
  await expect(page.getByLabel("Entrada por jogador")).toHaveValue("5");
  const suggestions = page.getByRole("group", { name: "Valores rápidos" });
  for (const value of [1, 5, 10, 50]) await expect(suggestions.getByRole("button", { name: `${value} Croins`, exact: true })).toBeVisible();
  await suggestions.getByRole("button", { name: "10 Croins", exact: true }).click();
  await expect(page.getByLabel("Entrada por jogador")).toHaveValue("10");
  await expect(page.getByRole("button", { name: "Pagar 10 Croins e jogar" })).toBeDisabled();
});

test("contador libera o botão na meia-noite de São Paulo", async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-19T02:59:58Z') });
  daily = { balance: 40, eligible: false, lastClaimAt: '2026-11-19T01:00:00.000Z', nextClaimAt: '2026-11-19T03:00:00.000Z', serverNow: '2026-11-19T02:59:58.000Z' };
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Aguarde o próximo resgate' })).toBeDisabled();
  await page.clock.runFor(3000);
  await expect(page.getByRole('button', { name: 'Resgatar', exact: true })).toBeEnabled();
});

test("saldo anima ganhos e perdas, sem repetir o efeito no reload", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const number = page.locator("header [aria-live=polite] + span").first();
  const delta = page.locator("header [aria-live=polite] + span + span").first();
  await expect(number).toHaveText("30");
  await expect(delta).toHaveCSS("opacity", "0");
  // Refresh the confirmed wallet, as happens after a coupon or on returning to the tab.
  daily = { ...daily, balance: 40 };
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(delta).toHaveText("+10");
  await expect(number).toHaveText("40");
  await expect(delta).toHaveCSS("opacity", "0");
  daily = { ...daily, balance: 25 };
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(delta).toHaveText("−15");
  await expect(delta).toHaveAttribute("data-direction", "loss");
  await expect(number).toHaveText("25");
  await page.reload();
  await expect(number).toHaveText("25");
  await expect(delta).toHaveCSS("opacity", "0");
  await expect(delta).toBeEmpty();
});

test("movimento reduzido atualiza o saldo diretamente", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const number = page.locator("header [aria-live=polite] + span").first();
  const delta = page.locator("header [aria-live=polite] + span + span").first();
  await expect(number).toHaveText("30");
  daily = { ...daily, balance: 40 };
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(number).toHaveText("40");
  await expect(delta).toHaveCSS("opacity", "0");
});

test("cupom fecha o modal antes de atualizar e animar o saldo", async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.route("**/api/v1/auth/csrf", route => route.fulfill({ json: { token: "fixture" } }));
  let redeemed = false;
  await page.route("**/api/v1/coupons/redeem", async route => {
    daily = { ...daily, balance: 80 };
    redeemed = true;
    await route.fulfill({ json: daily });
  });
  await page.route("**/api/v1/rewards/daily", async route => {
    if (redeemed) await expect(page.getByRole("dialog")).toHaveCount(0);
    await route.fulfill({ json: daily });
  });
  await page.goto("/");
  if (isMobile) {
    await page.locator("header").getByRole("link", { name: "Ver carteira" }).click();
    await page.getByRole("main").getByRole("button", { name: "Resgatar cupom" }).click();
  } else await page.locator("header").getByRole("button", { name: "Resgatar cupom" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Código do cupom").fill("LIVE50");
  await dialog.getByRole("button", { name: "Resgatar cupom", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("header [aria-live=polite] + span + span").first()).toHaveText("+50");
  await expect(page.locator("header [aria-live=polite] + span").first()).toHaveText("80");
});
