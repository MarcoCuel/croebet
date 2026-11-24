import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho", role: "user" };
const entries = Array.from({ length: 25 }, (_, index) => ({
  id: `93089d02-0b34-4b78-9d3e-${String(index).padStart(12, "0")}`,
  createdAt: "2026-11-19T04:08:00.000Z", description: index === 2 ? "Bônus diário recebido" : index % 2 ? "Aposta no Flip 7" : "Prêmio recebido",
  amount: index % 2 ? -50 : 200, balance: 1250, reference: "Partida Flip 7",
}));
let api: Server;
let unavailable = false;
function history(url: string) {
  const query = new URL(url, "http://localhost").searchParams;
  const direction = query.get("direction");
  const filtered = entries.filter(entry => direction === "income" ? entry.amount > 0 : direction === "expense" ? entry.amount < 0 : true);
  const offset = Number(query.get("offset") ?? 0);
  return { items: filtered.slice(offset, offset + 20), hasMore: filtered.length > offset + 20 };
}
test.beforeAll(async () => {
  api = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/api/v1/me") return response.end(JSON.stringify({ user }));
    if (unavailable) { response.statusCode = 503; response.end("{}"); return; }
    response.end(JSON.stringify(request.url?.includes("transactions") ? history(request.url) : { balance: 1250 }));
  });
  await new Promise<void>((resolve, reject) => { api.once("error", reject); api.listen(3201, "127.0.0.1", resolve); });
});
test.afterAll(async () => {
  if (!api?.listening) return;
  api.closeAllConnections();
  await new Promise<void>((resolve, reject) => api.close(error => error ? reject(error) : resolve()));
});
test.beforeEach(async ({ context, page }) => {
  unavailable = false;
  await context.addCookies([{ name: "croebet-session", value: "wallet-test", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/me", route => route.fulfill({ json: { user } }));
  await page.route("**/api/v1/me/transactions?*", route => route.fulfill({ json: history(route.request().url()) }));
});
test("saldo e primeiras 20 operações já estão no HTML sem JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await context.addCookies([{ name: "croebet-session", value: "wallet-test", url: "http://127.0.0.1:3100" }]);
  const page = await context.newPage();
  await page.goto("/carteira");
  await expect(page.getByText("Saldo disponível")).toBeVisible();
  await expect(page.locator("main [aria-live=polite]")).toContainText("1.250");
  await expect(page.locator("main li")).toHaveCount(20);
  await context.close();
});
test("detalhes, paginação e filtros consultam o extrato", async ({ page }) => {
  await page.goto("/carteira");
  await expect(page.locator("main li")).toHaveCount(20);
  await expect(page.getByText("Saldo após a operação")).toHaveCount(0);
  await expect(page.locator("main li").first().getByText("+200 Croins", { exact: true })).toHaveClass(/text-tertiary/);
  await expect(page.locator("main li").nth(1).getByText("−50 Croins", { exact: true })).toHaveClass(/text-brand/);
  await expect(page.locator("main li").first().locator("button > span").first()).toHaveClass(/bg-tertiary text-white/);
  await expect(page.locator("main li").nth(1).locator("button > span").first()).toHaveClass(/bg-brand text-white/);
  await expect(page.locator("main li").nth(2).locator("button > span").first()).toHaveClass(/bg-secondary text-white/);
  await page.locator("main li").first().getByRole("button").click();
  await expect(page.getByRole("dialog").getByText("Saldo após a operação")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Partida Flip 7")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("+200 Croins", { exact: true })).toHaveClass(/text-tertiary/);
  await page.keyboard.press("Escape");
  await page.locator("main li").nth(1).getByRole("button").click();
  await expect(page.getByRole("dialog").getByText("−50 Croins", { exact: true })).toHaveClass(/text-brand/);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Carregar mais" }).click();
  await expect(page.locator("main li")).toHaveCount(25);
  await expect(page.getByRole("button", { name: "Carregar mais" })).toHaveCount(0);
  await page.getByRole("link", { name: "Saídas", exact: true }).click();
  await expect(page.locator("main li")).toHaveCount(12);
  await expect(page.locator("main li").first()).toContainText("−50 Croins");
  await page.getByRole("link", { name: "Entradas", exact: true }).click();
  await expect(page.locator("main li")).toHaveCount(13);
});
test("falha do serviço permite tentar novamente sem mostrar saldo zero", async ({ page }) => {
  unavailable = true;
  await page.goto("/carteira");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Não foi possível carregar sua carteira.");
  await expect(page.getByText("Saldo disponível")).toHaveCount(0);
  unavailable = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Saldo disponível")).toBeVisible();
});
