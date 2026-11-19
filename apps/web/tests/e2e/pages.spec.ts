import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import type { SitePageRecord } from "@croebet/shared";

const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Admin", displayName: "Admin", role: "admin" };
const base: SitePageRecord = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5c", slug: "sobre", title: "Sobre", document: [{ tag: "p", children: ["Conteúdo compartilhado"] }], published: true, showInMenu: true, version: 1 };
let pages: SitePageRecord[] = [];
let failure = false;
let api: Server;
function respond(path: string, method: string, body: Record<string, unknown> = {}, authenticated = true): { status: number; data: unknown } {
  if (path === "/api/v1/me") return { status: 200, data: { user: authenticated ? user : null } };
  if (path === "/api/v1/auth/csrf") return { status: 200, data: { token: "fixture" } };
  if (path === "/api/v1/economy") return { status: 200, data: { initialBalance: 30, dailyReward: 10, dailyResetTimeZone: "America/Sao_Paulo", suggestedBets: [1, 5, 10, 50], defaultBet: 5 } };
  if (path === "/api/v1/rewards/daily") return { status: 200, data: { balance: 30, eligible: true, lastClaimAt: null, nextClaimAt: null, serverNow: new Date().toISOString() } };
  if (path.startsWith("/api/v1/admin/") && !authenticated) return { status: 404, data: {} };
  if (failure) return { status: 503, data: {} };
  if (path === "/api/v1/pages") return { status: 200, data: { items: pages.filter(p => p.published).map(p => ({ slug: p.slug, title: p.title, showInMenu: p.showInMenu })) } };
  if (path === "/api/v1/admin/pages") return { status: 200, data: { items: pages } };
  const slug = path.split("/").at(-1);
  const page = pages.find(p => p.slug === slug);
  if (!page || (!path.includes("/admin/") && !page.published)) return { status: 404, data: {} };
  if (method === "PATCH") {
    if (body.version !== page.version) return { status: 409, data: { error: { message: "A página foi alterada. Recarregue antes de salvar." } } };
    Object.assign(page, body, { version: page.version + 1 });
  }
  return { status: 200, data: page };
}
test.beforeAll(async () => {
  api = createServer((request, response) => {
    const result = respond(request.url ?? "", request.method ?? "GET", {}, Boolean(request.headers.cookie));
    response.writeHead(result.status, { "content-type": "application/json" }); response.end(JSON.stringify(result.data));
  });
  await new Promise<void>((resolve, reject) => { api.once("error", reject); api.listen(3201, "127.0.0.1", resolve); });
});
test.afterAll(async () => { if (api?.listening) await new Promise<void>(resolve => api.close(() => resolve())); });
test.beforeEach(async ({ page, context }) => {
  pages = [structuredClone(base), { ...structuredClone(base), id: "93089d02-0b34-4b78-9d3e-f2679c190b5d", slug: "rascunho", title: "Segredo", published: false }]; failure = false;
  await context.addCookies([{ name: "croebet-session", value: "pages-test", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/**", async route => {
    const request = route.request(); const result = respond(new URL(request.url()).pathname, request.method(), request.postDataJSON() ?? {});
    await route.fulfill({ status: result.status, json: result.data });
  });
});
test("página, menu e rodapé chegam no HTML público sem JavaScript; rascunho fica privado", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage();
  await page.goto("/sobre");
  await expect(page.getByText("Conteúdo compartilhado", { exact: true })).toBeVisible();
  await expect(page.locator("footer").getByRole("link", { name: "Sobre", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Segredo", exact: true })).toHaveCount(0);
  expect((await page.goto("/rascunho"))?.status()).toBe(404);
  await context.close();
});
test("edição publica para outro navegador e detecta conflito", async ({ page, browser }) => {
  await page.goto("/admin/paginas/sobre");
  await page.getByLabel("Título", { exact: true }).fill("Nossa história");
  await page.getByRole("button", { name: "Salvar página" }).click();
  await expect(page).toHaveURL(/\/admin\/paginas$/);
  const context = await browser.newContext({ javaScriptEnabled: false }); const visitor = await context.newPage();
  await visitor.goto("/sobre"); await expect(visitor).toHaveTitle("Nossa história · Croebet");
  await expect(visitor.locator("footer").getByRole("link", { name: "Nossa história" })).toBeVisible();
  await context.close();
  await page.goto("/admin/paginas/sobre"); pages[0].version++;
  await page.getByRole("button", { name: "Salvar página" }).click();
  await expect(page.getByText("A página foi alterada. Recarregue antes de salvar.")).toBeVisible();
});
test("falha do serviço tem tentativa novamente e não vira 404", async ({ page }) => {
  failure = true; await page.goto("/sobre");
  await expect(page.getByText("Não foi possível carregar esta página.", { exact: true })).toBeVisible();
  failure = false; await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Conteúdo compartilhado", { exact: true })).toBeVisible();
});
