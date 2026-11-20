import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

const adminId = "93089d02-0b34-4b78-9d3e-f2679c190b5b";
const userId = "93089d02-0b34-4b78-9d3e-f2679c190b5c";
const couponId = "93089d02-0b34-4b78-9d3e-f2679c190b5d";
const opId = "93089d02-0b34-4b78-9d3e-f2679c190b5e";
const admin = { id: adminId, username: "Marco", displayName: "Marco", role: "admin" };
const baseUser = { id: userId, username: "Tonho", displayName: "Tonho", role: "user", status: "active", balance: 30, createdAt: "2026-11-19T04:00:00.000Z", avatarUrl: null };
let user = { ...baseUser };
let balance = 30;
let unavailable = false;
let adminRole = "admin";
let coupon: { id: string; code: string; amount: number; limit: number | null; startsAt: string | null; endsAt: string | null; paused: boolean; version: number; redeemed: number; distributed: number; status: string } | null = null;
let transactions: { id: string; description: string; amount: number; balance: number; createdAt: string; reference?: string }[] = [];
let audit: { id: string; actorId: string; actorUsername: string; action: string; reason: string; createdAt: string; details: Record<string, unknown> }[] = [];
let lastBody: Record<string, unknown> = {};
let api: Server;
function respond(method: string, url: string, body: Record<string, unknown> = {}) {
  const path = new URL(url, "http://api").pathname;
  const page = { items: [] as unknown[], hasMore: false };
  if (path === "/api/v1/me") return { user: { ...admin, role: adminRole } };
  if (path === "/api/v1/economy") return { initialBalance: 30, dailyReward: 10, dailyResetTimeZone: 'America/Sao_Paulo', suggestedBets: [1, 5, 10, 50], defaultBet: 5 };
  if (path === "/api/v1/me/wallet") return { balance };
  if (path === "/api/v1/me/transactions") return page;
  if (path === "/api/v1/auth/csrf") return { token: "fixture" };
  if (path === "/api/v1/rewards/daily" || path === "/api/v1/coupons/redeem") {
    if (method === "POST") { balance += coupon?.amount ?? 0; lastBody = body; }
    return { balance, eligible: true, lastClaimAt: null, nextClaimAt: null, serverNow: new Date().toISOString() };
  }
  if (path === "/api/v1/admin/users") {
    const query = new URL(url, "http://api").searchParams;
    const q = (query.get("q") ?? "").toLowerCase(); const status = query.get("status") ?? "all";
    const items = user.username.toLowerCase().includes(q) && (status === "all" || status === user.status) ? [user] : [];
    return { items, total: items.length, hasMore: false, counts: { all: user.username.toLowerCase().includes(q) ? 1 : 0, active: user.username.toLowerCase().includes(q) && user.status === "active" ? 1 : 0, suspended: user.username.toLowerCase().includes(q) && user.status === "suspended" ? 1 : 0 } };
  }
  if (path === `/api/v1/admin/users/${userId}/identity` && method === "PATCH") {
    lastBody=body;user={...user,displayName:String(body.displayName),username:String(body.username)};
    audit.unshift({id:randomUUID(),actorId:adminId,actorUsername:"Marco",action:"user.identity",reason:"",details:{},createdAt:new Date().toISOString()});
    return {ok:true};
  }
  if (path === `/api/v1/admin/users/${userId}` && method === "PATCH") {
    lastBody = body; user = { ...user, role: String(body.role), status: String(body.status) };
    audit.unshift({ id: opId, actorId: adminId, actorUsername: "Marco", action: "user.permissions", reason: String(body.reason), details: {}, createdAt: new Date().toISOString() });
    return { ok: true };
  }
  if (path === `/api/v1/admin/users/${userId}/adjustments`) {
    lastBody = body; const amount = Number(body.amount) * (body.direction === "add" ? 1 : -1); user.balance += amount;
    transactions.unshift({ id: opId, description: "Ajuste administrativo · Crédito", amount, balance: user.balance, createdAt: new Date().toISOString(), reference: String(body.reason) });
    return { ok: true };
  }
  if (path === `/api/v1/admin/users/${userId}`) return { user, transactions: { items: transactions, hasMore: false }, audit: { items: audit, hasMore: false } };
  if (path === "/api/v1/admin/coupons" && method === "POST" || path === `/api/v1/admin/coupons/${couponId}` && method === "PATCH") {
    lastBody = body;
    coupon = { id: couponId, code: String(body.code), amount: Number(body.amount), limit: body.limit === null ? null : Number(body.limit), startsAt: body.startsAt as string | null,
      endsAt: body.endsAt as string | null, paused: Boolean(body.paused), version: (coupon?.version ?? -1) + 1, redeemed: 0, distributed: 0, status: body.paused ? "Pausado" : "Ativo" };
    return { id: couponId };
  }
  if (path === "/api/v1/admin/coupons") return { items: coupon ? [coupon] : [], total: coupon ? 1 : 0, hasMore: false, counts: { Todos: coupon ? 1 : 0, Ativo: coupon?.status === "Ativo" ? 1 : 0, Agendado: 0, Pausado: coupon?.status === "Pausado" ? 1 : 0, Expirado: 0, Esgotado: 0 } };
  if (path === `/api/v1/admin/coupons/${couponId}`) return { coupon, redemptions: page, audit: page };
  return page;
}
test.beforeAll(async () => {
  api = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (adminRole !== "admin" && request.url?.startsWith("/api/v1/admin")) { response.statusCode = 404; response.end("{}"); return; }
    if (unavailable && request.url?.startsWith("/api/v1/admin")) { response.statusCode = 503; response.end("{}"); return; }
    response.end(JSON.stringify(respond(request.method ?? "GET", request.url ?? "/")));
  });
  await new Promise<void>((resolve, reject) => { api.once("error", reject); api.listen(3201, "127.0.0.1", resolve); });
});
test.afterAll(async () => { if (api?.listening) await new Promise<void>(resolve => api.close(() => resolve())); });
test.beforeEach(async ({ context, page }) => {
  user = { ...baseUser }; balance = 30; coupon = null; transactions = []; audit = []; lastBody = {}; unavailable = false; adminRole = "admin";
  await context.addCookies([{ name: "croebet-session", value: "management-test", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/**", route => {
    const request = route.request();
    if (adminRole !== "admin" && request.url().includes("/api/v1/admin")) return route.fulfill({ status: 404, json: {} });
    return route.fulfill({ json: respond(request.method(), request.url(), request.postDataJSON() ?? {}) });
  });
});
test("lista de usuários reais já está no HTML sem JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  await context.addCookies([{ name: "croebet-session", value: "management-test", url: "http://127.0.0.1:3100" }]);
  const page = await context.newPage(); await page.goto("/admin/usuarios");
  await expect(page.getByRole("link", { name: "Ver usuário Tonho" })).toBeVisible();
  await expect(page.getByText("Carregando painel…")).toHaveCount(0);
  await context.close();
});
test("alteração de permissão envia motivo e estado esperado ao backend", async ({ page }) => {
  await page.goto(`/admin/usuarios/${userId}`);
  await page.getByRole("button", { name: "Editar permissão", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: /^Permissão/ }).selectOption("admin");
  await dialog.getByLabel("Motivo").fill("Equipe de moderação");
  await dialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Equipe de moderação", { exact: true })).toBeVisible();
  expect(lastBody.expectedRole).toBe("user"); expect(lastBody.role).toBe("admin");
});
test("ajuste sem motivo atualiza saldo e movimentações", async ({ page }) => {
  await page.goto(`/admin/usuarios/${userId}`);
  await page.getByRole("button", { name: "Ajustar Croins" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Valor em Croins").fill("7");
  await dialog.getByRole("button", { name: "Adicionar Croins", exact: true }).click();
  await expect(page.getByText("Ajuste administrativo · Crédito")).toBeVisible();
  await expect(page.getByText("Saldo: 37", { exact: true })).toBeVisible();
  expect(lastBody.amount).toBe(7); expect(lastBody.reason).toBe(""); expect(lastBody.requestId).toEqual(expect.any(String));
});
test("cupom é criado com valor livre, datas UTC e resgatado pela carteira", async ({ page, isMobile }) => {
  await page.goto("/admin/cupons/novo");
  await expect(page.getByLabel("Croins por resgate")).toHaveValue("");
  await page.getByLabel("Código do cupom").fill("LIVE7");
  await page.getByLabel("Croins por resgate").fill("7");
  await page.getByLabel("Início (Brasília, UTC−03)", { exact: true }).fill("2026-01-01T12:00");
  await page.getByLabel("Motivo").fill("Cupom da live");
  await page.getByRole("button", { name: "Salvar cupom", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/cupons/${couponId}$`));
  expect(lastBody.startsAt).toBe("2026-01-01T15:00:00.000Z"); expect(lastBody.limit).toBeNull();
  if (isMobile) {
    await page.locator("header").getByRole("link", { name: "Ver carteira" }).click();
    await page.getByRole("main").getByRole("button", { name: "Resgatar cupom" }).click();
  } else await page.locator("header").getByRole("button", { name: "Resgatar cupom" }).click();
  const dialog = page.getByRole("dialog"); await dialog.getByLabel("Código do cupom").fill("live7");
  await dialog.getByRole("button", { name: "Resgatar cupom", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("header [aria-live=polite]").first()).toContainText("37");
  expect(lastBody.code).toBe("LIVE7");
});
test("falha inicial da API não é apresentada como lista vazia", async ({ page }) => {
  unavailable = true; await page.goto("/admin/usuarios");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Não foi possível carregar estes dados.");
  await expect(page.getByText("Nenhum usuário encontrado.")).toHaveCount(0);
  unavailable = false; await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("link", { name: "Ver usuário Tonho" })).toBeVisible();
});

test("busca e filtro consultam as contas reais sem carteiras de demonstração", async ({ page }) => {
  await page.goto("/admin/usuarios");
  const search = page.getByRole("searchbox", { name: "Buscar usuários no admin" });
  await search.fill("inexistente"); await search.press("Enter");
  await expect(page.getByText("Nenhum usuário encontrado.")).toBeVisible();
  await page.getByRole("searchbox", { name: "Buscar usuários no admin" }).fill("Tonho");
  await search.press("Enter");
  await expect(page.getByRole("link", { name: "Ver usuário Tonho" })).toBeVisible();
  await page.getByRole("link", { name: "Suspensos", exact: true }).click();
  await expect(page.getByText("Nenhum usuário encontrado.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("croebet:demo-wallet:tonho"))).toBeNull();
});
test("conta comum recebe 404 nas páginas administrativas", async ({ page }) => {
  adminRole = "user";
  for (const path of ["/admin/usuarios", `/admin/usuarios/${userId}`, "/admin/cupons/novo"]) {
    await page.goto(path); await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ajustar Croins" })).toHaveCount(0);
  }
});
test("pausa do cupom envia versão e motivo e permanece após reload", async ({ page }) => {
  coupon = { id: couponId, code: "PAUSA7", amount: 7, limit: null, startsAt: null, endsAt: null, paused: false, version: 0, redeemed: 0, distributed: 0, status: "Ativo" };
  await page.goto(`/admin/cupons/${couponId}`);
  await page.getByLabel("Cupom pausado").check(); await page.getByLabel("Motivo").fill("Pausa da live");
  await page.getByRole("button", { name: "Salvar cupom", exact: true }).click();
  await expect(page.getByText("Pausado", { exact: true })).toBeVisible();
  expect(lastBody.version).toBe(0); expect(lastBody.paused).toBe(true);
  await page.reload(); await expect(page.getByLabel("Cupom pausado")).toBeChecked();
});

test("linhas editáveis alteram nome e usuário pelo admin", async ({page}) => {
  await page.goto(`/admin/usuarios/${userId}`);
  await page.getByRole("button",{name:"Editar nome",exact:true}).click();
  let dialog=page.getByRole("dialog");
  await dialog.getByLabel("Nome",{exact:true}).fill("Tonho da comunidade");
  await dialog.getByRole("button",{name:"Salvar alterações"}).click();
  await expect(page.getByRole("heading",{name:"Tonho da comunidade",exact:true})).toBeVisible();
  expect(lastBody.expectedDisplayName).toBe("Tonho");expect(lastBody.username).toBe("Tonho");
  await page.getByRole("button",{name:"Editar nome de usuário",exact:true}).click();
  dialog=page.getByRole("dialog");
  await dialog.getByLabel("Nome de usuário",{exact:true}).fill("Tonho_Novo");
  await dialog.getByRole("button",{name:"Salvar alterações"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(lastBody.expectedUsername).toBe("Tonho");expect(lastBody.displayName).toBe("Tonho da comunidade");
  await page.reload();
  await expect(page.getByText("@Tonho_Novo",{exact:true}).first()).toBeVisible();
  await page.getByRole("button",{name:"Editar status",exact:true}).click();
  dialog=page.getByRole("dialog");
  await dialog.getByLabel("Status",{exact:true}).selectOption("suspended");
  await dialog.getByRole("button",{name:"Salvar alterações"}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(lastBody.role).toBe("user");expect(lastBody.status).toBe("suspended");
});
