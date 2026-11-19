import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import type { SitePageRecord } from "@croebet/shared";

const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Admin", displayName: "Admin", role: "admin" };
const base: SitePageRecord = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5c", slug: "sobre", title: "Sobre", document: [{ tag: "p", children: ["Conteúdo compartilhado"] }], published: true, showInMenu: true, version: 1, createdAt: null, updatedAt: null, publishedAt: null, lastEditedBy: null, status: "published", publishAt: null, authorId: user.id, authorName: user.displayName };
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
  if (path === "/api/v1/navigation") {
    const about = pages.find(page => page.id === base.id && page.published);
    const items = about ? [{ id: base.id, label: "Sobre", href: `/${about.slug}`, newTab: false, fixed: null, disabled: false }] : [];
    return { status: 200, data: { main: items, footer: items } };
  }
  if (path === "/api/v1/pages") return { status: 200, data: { items: pages.filter(p => p.published).map(p => ({ slug: p.slug, title: p.title, showInMenu: p.showInMenu })) } };
  if (path === "/api/v1/admin/page-authors") return { status: 200, data: { items: [{ id: user.id, username: user.username, displayName: user.displayName }] } };
  if (path === "/api/v1/admin/pages" && method === "POST") {
    const now = new Date().toISOString();
    const created = { ...structuredClone(base), ...body, id: crypto.randomUUID(), version: 1, createdAt: now, updatedAt: now, lastEditedBy: user.username, publishedAt: body.published ? now : null } as SitePageRecord;
    pages.push(created);
    return { status: 200, data: created };
  }
  if (path === "/api/v1/admin/pages") return { status: 200, data: { items: pages } };
  const slug = path.split("/").at(-1);
  const page = pages.find(p => path.includes("/admin/") ? p.id === slug : p.slug === slug);
  if (!page || (!path.includes("/admin/") && !page.published)) return { status: 404, data: {} };
  if (method === "DELETE") {
    if (body.version !== page.version) return { status: 409, data: { error: { message: "A página foi alterada. Recarregue antes de excluir." } } };
    pages = pages.filter(item => item.id !== page.id);
    return { status: 200, data: { ok: true } };
  }
  if (method === "PATCH") {
    if (body.version !== page.version) return { status: 409, data: { error: { message: "A página foi alterada. Recarregue antes de salvar." } } };
    Object.assign(page, body, { version: page.version + 1, updatedAt: new Date().toISOString(), lastEditedBy: user.username, publishedAt: body.published && !page.published ? new Date().toISOString() : page.publishedAt });
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
  pages = [structuredClone(base), { ...structuredClone(base), id: "93089d02-0b34-4b78-9d3e-f2679c190b5d", slug: "rascunho", title: "Segredo", status: "draft", published: false }]; failure = false;
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
  await page.goto(`/admin/paginas/${base.id}`);
  await page.getByLabel("Título", { exact: true }).fill("Nossa história");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Página salva.", { exact: true })).toBeVisible();
  const context = await browser.newContext({ javaScriptEnabled: false }); const visitor = await context.newPage();
  await visitor.goto("/sobre"); await expect(visitor).toHaveTitle("Nossa história · Croebet");
  await expect(visitor.locator("footer").getByRole("link", { name: "Sobre", exact: true })).toBeVisible();
  await context.close();
  await page.getByRole("button", { name: "Editar slug", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Slug", { exact: true }).fill("nossa-historia");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect.poll(() => pages[0].slug).toBe("nossa-historia");
  await expect(page.getByText("Página salva.", { exact: true }).last()).toBeVisible();
  await expect(page).toHaveURL(`http://127.0.0.1:3100/admin/paginas/${base.id}`);
  await page.reload();
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Nossa história");
  expect(pages[0].slug).toBe("nossa-historia");
  await page.goto(`/admin/paginas/${base.id}`); pages[0].version++;
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("A página foi alterada. Recarregue antes de salvar.")).toBeVisible();
});
test("falha do serviço tem tentativa novamente e não vira 404", async ({ page }) => {
  failure = true; await page.goto("/sobre");
  await expect(page.getByText("Não foi possível carregar esta página.", { exact: true })).toBeVisible();
  failure = false; await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Conteúdo compartilhado", { exact: true })).toBeVisible();
});

async function setStatus(page: import("@playwright/test").Page, status: string) {
  await page.getByRole("button", { name: "Editar status", exact: true }).click();
  await page.getByRole("dialog").getByRole("combobox", { name: /^Status/ }).selectOption(status);
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
}
test("lista vazia, modais, rascunho, publicação e exclusão", async ({ page }) => {
  pages = [];
  await page.goto("/admin/paginas");
  await expect(page.getByText("Nenhuma página criada ainda.")).toBeVisible();
  await page.getByRole("link", { name: "Nova página", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mover para o lixo", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publicar", exact: true })).toBeVisible();
  await page.getByLabel("Título", { exact: true }).fill("Ajuda");
  await page.getByRole("button", { name: "Editar slug", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Slug", { exact: true }).fill("ajuda-da-casa");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await page.getByRole("button", { name: "Editar autor", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("combobox", { name: /^Autor/ })).toHaveValue(user.id);
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await setStatus(page, "draft");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/paginas\/[0-9a-f-]{36}$/);
  await expect(page).toHaveURL(`http://127.0.0.1:3100/admin/paginas/${pages[0].id}`);
  await expect(page.getByRole("button", { name: "Mover para o lixo", exact: true })).toBeVisible();
  expect(pages[0].published).toBe(false);
  await setStatus(page, "published");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Escreva o conteúdo da página antes de publicar.")).toBeVisible();
  await page.getByRole("textbox", { name: "Conteúdo principal" }).fill("Como funciona");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Página salva.", { exact: true })).toBeVisible();
  await expect.poll(() => pages[0].published).toBe(true);
  await page.getByRole("button", { name: "Mover para o lixo", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Mover página para o lixo?", exact: true })).toBeVisible();
  expect(pages).toHaveLength(1);
  await page.getByRole("dialog").getByRole("button", { name: "Mover para o lixo", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/paginas$/);
  expect(pages[0].status).toBe("trash");
  await page.getByRole("button", { name: /^Lixo/ }).click();
  await page.getByRole("button", { name: "Excluir permanentemente", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir permanentemente", exact: true }).click();
  await expect(page.getByText("Nenhuma página criada ainda.")).toBeVisible();
  expect(pages).toHaveLength(0);
});
test("data futura muda a ação para Agendar e mantém a página privada", async ({ page }) => {
  await page.goto("/admin/paginas/nova");
  await page.getByLabel("Título", { exact: true }).fill("Novidades");
  await page.getByRole("textbox", { name: "Conteúdo principal" }).fill("Em breve");
  await page.getByRole("button", { name: "Editar publicar", exact: true }).click();
  await page.getByLabel("Data e hora (Brasília)").fill("2099-12-01T12:00");
  await page.getByRole("button", { name: "Aplicar", exact: true }).click();
  await page.getByRole("button", { name: "Agendar", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/paginas\/[0-9a-f-]{36}$/);
  await expect(page).toHaveURL(`http://127.0.0.1:3100/admin/paginas/${pages.at(-1)?.id}`);
  expect(pages.at(-1)?.status).toBe("scheduled");
  expect(pages.at(-1)?.published).toBe(false);
  expect((await page.goto("/novidades"))?.status()).toBe(404);
});

test("listagem combina busca e status, move para o lixo e restaura sem publicar", async ({ page }) => {
  await page.goto("/admin/paginas");
  const list = page.getByRole("list", { name: "Páginas", exact: true });
  await expect(list.getByRole("link", { name: "Sobre", exact: true })).toBeVisible();
  await expect(list.getByRole("link", { name: "Segredo", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Publicado/ }).click();
  await expect(list.getByRole("link", { name: "Segredo", exact: true })).toHaveCount(0);
  await page.getByRole("searchbox", { name: "Buscar páginas", exact: true }).fill("SÓBRE");
  await expect(list.getByRole("link", { name: "Sobre", exact: true })).toBeVisible();
  await page.getByRole("searchbox").fill("inexistente");
  await expect(page.getByText("Nenhuma página encontrada.")).toBeVisible();
  await page.getByRole("searchbox").fill("");
  await page.getByRole("button", { name: "Mover Sobre para o lixo", exact: true }).click();
  await expect(list.getByRole("link", { name: "Sobre", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /^Lixo/ }).click();
  await expect(page.getByRole("button", { name: /^Lixo/ })).toHaveAccessibleName(/^Lixo\s*\(?1\)?$/);
  await expect(list.getByText("Sobre", { exact: true })).toBeVisible();
  expect(pages[0].published).toBe(false);
  await page.reload();
  await page.getByRole("button", { name: /^Lixo/ }).click();
  await page.getByRole("button", { name: "Restaurar", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Lixo/ })).toHaveAccessibleName(/^Lixo\s*\(?0\)?$/);
  await page.getByRole("button", { name: /^Rascunho/ }).click();
  await expect(list.getByRole("link", { name: "Sobre", exact: true })).toBeVisible();
  expect(pages[0].status).toBe("draft"); expect(pages[0].published).toBe(false);
});
