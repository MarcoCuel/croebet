import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho", role: "user" };
const economy = { initialBalance: 30, dailyReward: 10, dailyResetTimeZone: 'America/Sao_Paulo', suggestedBets: [1, 5, 10, 50], defaultBet: 5 };
const initial = () => ({ balance: 30, lastClaimAt: null as string | null, nextClaimAt: null as string | null, eligible: true, serverNow: new Date().toISOString() });
let daily = initial();
let api: Server;
test.beforeAll(async () => {
  api = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
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
