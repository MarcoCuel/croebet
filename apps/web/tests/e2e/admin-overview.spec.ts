import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import type { AdminOverviewData } from "@croebet/shared";

const id = "93089d02-0b34-4b78-9d3e-f2679c190b5b";
let api: Server;
let role = "admin";
let unavailable = false;
let empty = false;
function overview(days: 1 | 7 | 30): AdminOverviewData {
  const movements = empty ? 0 : days === 1 ? 1 : 3;
  return {
    days, generatedAt: "2026-11-19T15:00:00.000Z",
    totals: { users: empty ? 0 : 2, activeUsers: empty ? 0 : 1, movements, balance: empty ? 0 : 37 },
    rewards: { dailyClaims: empty || days === 1 ? 0 : 1, couponRedemptions: empty ? 0 : 1 },
    circulation: { registration: 0, daily: empty || days === 1 ? 0 : 10, coupons: empty ? 0 : 7, adjustments: 0, credits: empty ? 0 : 7, debits: 0 },
    buckets: Array.from({ length: days }, (_, index) => ({ day: new Date(Date.UTC(2026,10,19-days+index+1)).toISOString().slice(0,10), movements: index === days - 1 ? movements : 0, credits: index === days - 1 && !empty ? 7 : 0, debits: 0 })),
    recentUsers: empty ? [] : [{ id, username: "Tonho", createdAt: "2026-11-19T04:00:00.000Z" }],
    transactions: empty ? [] : [{ id, userId: id, username: "Tonho", description: "Cupom resgatado", amount: 7, createdAt: "2026-11-19T04:00:00.000Z" }],
  };
}
function respond(url: string) {
  const parsed = new URL(url, "http://api");
  if (parsed.pathname === "/api/v1/me") return { user: { id, username: "Marco", displayName: "Marco", role } };
  if (parsed.pathname === "/api/v1/economy") return { initialBalance: 30, dailyReward: 10, dailyResetTimeZone: "America/Sao_Paulo", suggestedBets: [1,5,10,50], defaultBet: 5 };
  if (parsed.pathname === "/api/v1/rewards/daily") return { balance: 37, lastClaimAt: null, nextClaimAt: null, eligible: true, serverNow: "2026-11-19T15:00:00.000Z" };
  if (parsed.pathname === "/api/v1/admin/overview") return overview(Number(parsed.searchParams.get("days") ?? 7) as 1 | 7 | 30);
  if (parsed.pathname === "/api/v1/admin/users") return { items: [], total: 0, hasMore: false, counts: { all: 0, active: 0, suspended: 0 } };
  if (parsed.pathname === "/api/v1/admin/coupons") return { items: [], total: 0, hasMore: false, counts: { Todos: 0, Ativo: 0, Agendado: 0, Pausado: 0, Expirado: 0, Esgotado: 0 } };
  return { items: [] };
}
test.beforeAll(async () => {
  api = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url?.startsWith("/api/v1/admin/overview") && (unavailable || role !== "admin")) {
      response.statusCode = role !== "admin" ? 404 : 503; response.end("{}"); return;
    }
    response.end(JSON.stringify(respond(request.url ?? "/")));
  });
  await new Promise<void>((resolve,reject) => { api.once("error",reject); api.listen(3201,"127.0.0.1",resolve); });
});
test.afterAll(async () => {
  if (!api?.listening) return;
  api.closeAllConnections();
  await new Promise<void>((resolve, reject) => api.close(error => error ? reject(error) : resolve()));
});
test.beforeEach(async ({ context, page }) => {
  role = "admin"; unavailable = false; empty = false;
  await context.addCookies([{ name: "croebet-session", value: "overview-fixture", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/**", route => route.fulfill({ json: respond(route.request().url()) }));
});
test("visão geral está no HTML inicial sem JavaScript ou contas locais", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await context.addCookies([{ name: "croebet-session", value: "overview-fixture", url: "http://127.0.0.1:3100" }]);
  const page = await context.newPage(); await page.goto("/admin");
  const panel = page.getByRole("region", { name: "Visão geral" });
  await expect(panel.getByText("Saldo dos usuários", { exact: true })).toBeVisible();
  await expect(panel.getByText("37", { exact: true })).toBeVisible();
  await expect(panel.getByText("Cupom resgatado", { exact: true })).toBeVisible();
  await expect(panel.getByText("Carregando painel…")).toHaveCount(0);
  await context.close();
});
test("períodos consultam a API e preservam o saldo atual após reload", async ({ page }) => {
  await page.goto("/admin");
  const panel = page.getByRole("region", { name: "Visão geral" });
  await expect(panel.getByRole("img")).toHaveAccessibleName(/3 movimentações/);
  await page.getByRole("link", { name: "Hoje", exact: true }).click();
  await expect(page).toHaveURL(/days=1/);
  await expect(panel.getByRole("img")).toHaveAccessibleName(/1 movimentações/);
  await expect(panel.getByText("37", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "30 dias", exact: true }).click();
  await expect(page).toHaveURL(/days=30/);
  await page.reload();
  await expect(page.getByRole("link", { name: "30 dias", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(panel.getByText("37", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("menu administrativo mantém o alinhamento em páginas curtas e longas", async ({ page, isMobile }) => {
  test.skip(isMobile, "Sidebar sticky é usada apenas no desktop.");
  let initialTop: number | undefined;
  for (const [path, name] of [["/admin", "Visão geral"], ["/admin/jogos", "Jogos"], ["/admin/apostas", "Apostas"], ["/admin/cupons", "Cupons"], ["/admin/usuarios", "Usuários"]]) {
    await page.goto(path);
    const menu = page.getByRole("navigation", { name: "Seções do admin" });
    const content = page.getByRole("region", { name, exact: true });
    await expect(menu).toBeVisible();
    await expect(content).toBeVisible();
    const menuBox = await menu.boundingBox();
    const contentBox = await content.boundingBox();
    expect(Math.abs(menuBox!.y - contentBox!.y)).toBeLessThan(1);
    initialTop ??= menuBox!.y;
    expect(Math.abs(menuBox!.y - initialTop)).toBeLessThan(1);
  }
  await page.goto("/admin");
  const menu = page.getByRole("navigation", { name: "Seções do admin" });
  await expect(menu).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 100));
  await expect.poll(async () => (await menu.boundingBox())!.y).toBeCloseTo(initialTop!, 0);
});
test("falha da API oferece nova tentativa sem inventar um painel zerado", async ({ page }) => {
  unavailable = true; await page.goto("/admin");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Não foi possível carregar estes dados.");
  await expect(page.getByText("Saldo dos usuários", { exact: true })).toHaveCount(0);
  unavailable = false; await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Saldo dos usuários", { exact: true })).toBeVisible();
});
test("base vazia confirmada mostra zeros e filtros continuam disponíveis", async ({ page }) => {
  empty = true; await page.goto("/admin");
  const panel = page.getByRole("region", { name: "Visão geral" });
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(page.getByText("Nenhum cadastro neste período.")).toBeVisible();
  await expect(panel.getByRole("img")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "7 dias", exact: true })).toBeVisible();
});
test("conta comum não recebe a visão geral administrativa", async ({ page }) => {
  role = "user"; await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  await expect(page.getByText("Saldo dos usuários", { exact: true })).toHaveCount(0);
});
