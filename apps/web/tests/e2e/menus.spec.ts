import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";
import { fixedMenuPages, type MenuRecord } from "@croebet/shared";
import { lucideIconNodes } from "@croebet/shared/lucide-icon-nodes";

const actorId = "93089d02-0b34-4b78-9d3e-f2679c190b5b";
const aboutId = "93089d02-0b34-4b78-9d3e-f2679c190b5c";
const draftId = "93089d02-0b34-4b78-9d3e-f2679c190b5d";
const itemId = "93089d02-0b34-4b78-9d3e-f2679c190b5e";
let menus: MenuRecord[];
let role = "admin";
let failure = false;
let pages: { id: string; title: string; slug: string; published: boolean }[];
let api: Server;
function respond(path: string, method: string, body: Record<string, unknown> = {}, authenticated = true): { status: number; data: unknown } {
  if (path === "/api/v1/me") return { status: 200, data: { user: authenticated ? { id: actorId, username: "Admin", displayName: "Admin", role } : null } };
  if (path === "/api/v1/economy") return { status: 200, data: { initialBalance: 30, dailyReward: 10, dailyResetTimeZone: "America/Sao_Paulo", suggestedBets: [1, 5, 10, 50], defaultBet: 5 } };
  if (path === "/api/v1/rewards/daily") return { status: 200, data: { balance: 30, eligible: true, lastClaimAt: null, nextClaimAt: null, serverNow: new Date().toISOString(), windowActive: false, nextWindowAt: null } };
  if (path === "/api/v1/auth/csrf") return { status: 200, data: { token: "fixture" } };
  if (path === "/api/v1/pages") return { status: 200, data: { items: pages.filter(page => page.published).map(page => ({ title: page.title, slug: page.slug, showInMenu: false })) } };
  if (path.startsWith("/api/v1/admin/") && (!authenticated || role !== "admin")) return { status: 404, data: {} };
  if (failure) return { status: 503, data: {} };
  if (path === "/api/v1/navigation") {
    return { status: 200, data: Object.fromEntries(menus.map(menu => [menu.location, menu.items.flatMap(item => {
      const page = item.type === "page" ? pages.find(page => page.id === item.pageId && page.published) : null;
      if (item.type === "page" && !page) return [];
      const fixed = item.type === "fixed" ? item.target : null;
      return [{ id: item.id, label: item.label, newTab: item.newTab, fixed, disabled: fixed ? fixedMenuPages[fixed].disabled : false,
        ...(item.icon ? { icon: item.icon, iconNode: lucideIconNodes[item.icon] } : {}),
        href: item.type === "custom" ? item.url : item.type === "fixed" ? fixedMenuPages[item.target].href : `/${page!.slug}` }];
    })])) };
  }
  if (path === "/api/v1/admin/menus") return { status: 200, data: { menus, pages } };
  if (path.startsWith("/api/v1/admin/menus/") && method === "PATCH") {
    const menu = menus.find(menu => menu.location === path.split("/").at(-1))!;
    if (body.version !== menu.version) return { status: 409, data: { error: { message: "Este menu foi alterado. Recarregue antes de salvar." } } };
    menu.items = body.items as MenuRecord["items"]; menu.version++;
    return { status: 200, data: menu };
  }
  return { status: 404, data: {} };
}
test.beforeAll(async () => {
  api = createServer((request, response) => {
    const result = respond(request.url ?? "", request.method ?? "GET", {}, Boolean(request.headers.cookie));
    response.writeHead(result.status, { "content-type": "application/json" }); response.end(JSON.stringify(result.data));
  });
  await new Promise<void>((resolve, reject) => { api.once("error", reject); api.listen(3201, "127.0.0.1", resolve); });
});
test.afterAll(async () => {
  if (!api?.listening) return;
  api.closeAllConnections();
  await new Promise<void>((resolve, reject) => api.close(error => error ? reject(error) : resolve()));
});
test.beforeEach(async ({ page, context }) => {
  role = "admin"; failure = false;
  pages = [{ id: aboutId, title: "Sobre", slug: "sobre", published: true }, { id: draftId, title: "Ajuda", slug: "ajuda", published: false }];
  menus = [
    { location: "main", version: 1, items: [{ id: actorId, type: "fixed", target: "home", label: "Início", newTab: false }, { id: itemId, type: "page", pageId: aboutId, label: "Sobre", newTab: false }] },
    { location: "footer", version: 1, items: [] },
  ];
  await context.addCookies([{ name: "croebet-session", value: "menus-test", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/**", async route => {
    const request = route.request(); const result = respond(new URL(request.url()).pathname, request.method(), request.postDataJSON() ?? {});
    await route.fulfill({ status: result.status, json: result.data });
  });
});
test("menu principal aceita rótulos, links personalizados, ordem e nova aba", async ({ page, browser }) => {
  await page.goto("/admin/menus");
  await page.getByLabel("Rótulo do link", { exact: true }).fill("Comunidade");
  await page.getByLabel("URL do link", { exact: true }).fill("https://example.com/comunidade");
  await page.getByRole("group", { name: "Link personalizado", exact: true }).getByRole("button", { name: "Adicionar", exact: true }).click();
  const customItem = page.getByRole("listitem", { name: "Item 3", exact: true });
  await expect(customItem.getByRole("switch", { name: "Abrir em nova aba", exact: true })).toBeHidden();
  await expect(customItem.getByLabel("Título", { exact: true })).toBeHidden();
  await customItem.locator("summary").focus();
  await page.keyboard.press("Enter");
  const titleBounds = await customItem.getByLabel("Título", { exact: true }).boundingBox();
  const removeBounds = await customItem.getByRole("button", { name: "Remover item 3" }).boundingBox();
  expect(titleBounds).not.toBeNull(); expect(removeBounds).not.toBeNull();
  expect(Math.abs((titleBounds!.y + titleBounds!.height / 2) - (removeBounds!.y + removeBounds!.height / 2))).toBeLessThan(1);
  await customItem.getByRole("switch", { name: "Abrir em nova aba", exact: true }).check();
  await customItem.getByText("Comunidade", { exact: true }).click();
  await expect(customItem.getByRole("switch", { name: "Abrir em nova aba", exact: true })).toBeHidden();
  await customItem.getByText("Comunidade", { exact: true }).click();
  await page.getByRole("button", { name: "Subir item 3" }).click();
  await page.getByRole("listitem", { name: "Item 3", exact: true }).getByText("Sobre", { exact: true }).click();
  await page.getByRole("listitem", { name: "Item 3", exact: true }).getByLabel("Título", { exact: true }).fill("Quem somos");
  await page.getByRole("button", { name: "Salvar menu", exact: true }).click();
  await expect(page.getByText("Menu salvo.", { exact: true })).toBeVisible();
  expect(menus[0].items.map(item => item.label)).toEqual(["Início", "Comunidade", "Quem somos"]);
  expect(menus[1].items).toHaveLength(0);
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const visitor = await context.newPage(); await visitor.goto("/");
  const nav = visitor.getByRole("navigation", { name: "Navegação principal", exact: true });
  await expect(nav.getByRole("link")).toHaveText(["Início", "Comunidade", "Quem somos"]);
  await expect(nav.getByRole("link", { name: "Comunidade" })).toHaveAttribute("target", "_blank");
  await expect(visitor.locator("footer").getByRole("link")).toHaveCount(0);
  await context.close();
});
test("rodapé tem itens independentes e páginas em rascunho ficam ocultas", async ({ page, browser }) => {
  await page.goto("/admin/menus");
  await page.getByLabel("Menu", { exact: true }).selectOption("footer");
  await page.getByLabel("Página fixa", { exact: true }).selectOption("history");
  await page.getByRole("group", { name: "Páginas fixas", exact: true }).getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByLabel("Página criada", { exact: true }).selectOption(draftId);
  await page.getByRole("group", { name: "Páginas criadas", exact: true }).getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("listitem", { name: "Item 2", exact: true }).getByText("Ajuda", { exact: true }).click();
  await expect(page.getByText("Oculta até a publicação", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Salvar menu", exact: true }).click();
  await expect(page.getByText("Menu salvo.", { exact: true })).toBeVisible();
  const context = await browser.newContext({ javaScriptEnabled: false }); const visitor = await context.newPage();
  await visitor.goto("/");
  await expect(visitor.locator("footer").getByRole("link")).toHaveText(["Carteira"]);
  pages[1].published = true; pages[1].slug = "central-de-ajuda";
  await visitor.reload();
  await expect(visitor.locator("footer").getByRole("link", { name: "Ajuda", exact: true })).toHaveAttribute("href", "/central-de-ajuda");
  await page.getByRole("listitem", { name: "Item 1", exact: true }).getByText("Carteira", { exact: true }).click();
  await page.getByRole("button", { name: "Remover item 1" }).click();
  await page.getByRole("button", { name: "Salvar menu", exact: true }).click();
  await expect(page.getByRole("button", { name: "Salvar menu", exact: true })).toBeDisabled();
  await expect.poll(() => menus[1].items.map(item => item.label)).toEqual(["Ajuda"]);
  expect(menus[0].items.map(item => item.label)).toEqual(["Início", "Sobre"]);
  await context.close();
});
test("conflitos preservam edição local; links executáveis são recusados", async ({ page }) => {
  await page.goto("/admin/menus");
  await page.getByLabel("Rótulo do link", { exact: true }).fill("Perigoso");
  await page.getByLabel("URL do link", { exact: true }).fill("javascript:alert(1)");
  await page.getByRole("group", { name: "Link personalizado", exact: true }).getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByText("Informe um link interno, http, https, mailto ou tel válido.")).toBeVisible();
  await page.getByRole("listitem", { name: "Item 1", exact: true }).getByText("Início", { exact: true }).click();
  await page.getByRole("listitem", { name: "Item 1", exact: true }).getByLabel("Título", { exact: true }).fill("Começar"); menus[0].version++;
  await page.getByRole("button", { name: "Salvar menu", exact: true }).click();
  await expect(page.getByText("Este menu foi alterado. Recarregue antes de salvar.")).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Item 1", exact: true }).getByLabel("Título", { exact: true })).toHaveValue("Começar");
});
test("configuração de menus é privada e falhas oferecem nova tentativa", async ({ page }) => {
  role = "user"; expect((await page.goto("/admin/menus"))?.status()).toBe(404);
  role = "admin"; failure = true; await page.goto("/admin/menus");
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
  failure = false; await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByLabel("Menu", { exact: true })).toBeVisible();
});
test("seletor pesquisa ícones, salva a escolha e permite removê-la", async ({ page, browser }) => {
  await page.goto("/admin/menus");
  const item = page.getByRole("listitem", { name: "Item 1", exact: true });
  await item.locator("summary").click();
  const trigger = item.getByRole("button", { name: "Selecionar ícone", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Ícones Lucide", exact: true });
  const search = dialog.getByRole("searchbox", { name: "Buscar ícones" });
  await expect(search).toBeFocused();
  const grid = dialog.getByRole("group", { name: "Ícones Lucide", exact: true });
  await expect(grid.getByRole("button")).toHaveCount(60);
  expect(await grid.evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length)).toBe(5);
  await dialog.getByRole("button", { name: "Mostrar mais ícones", exact: true }).click();
  await expect(grid.getByRole("button")).toHaveCount(120);
  await search.fill("nao-existe-este-icone");
  await expect(dialog.getByText("Nenhum ícone encontrado.")).toBeVisible();
  await search.fill("arrow right");
  await dialog.getByRole("button", { name: "Selecionar arrow-right", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText("arrow-right");
  await trigger.click();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page.getByRole("button", { name: "Salvar menu", exact: true }).click();
  await expect(page.getByText("Menu salvo.", { exact: true })).toBeVisible();
  expect(menus[0].items[0].icon).toBe("arrow-right");
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const visitor = await context.newPage();
  await visitor.goto("/");
  const link = visitor.getByRole("navigation", { name: "Navegação principal", exact: true }).getByRole("link", { name: "Início", exact: true });
  await expect(link.locator('svg[data-icon="arrow-right"]')).toBeVisible();
  await page.reload();
  await item.locator("summary").click();
  await expect(trigger).toContainText("arrow-right");
  await trigger.click();
  await dialog.getByRole("button", { name: "Remover", exact: true }).click();
  await expect(trigger).toContainText("Selecionar ícone");
  await page.getByRole("button", { name: "Salvar menu", exact: true }).click();
  await expect(page.getByText("Menu salvo.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar menu", exact: true })).toBeDisabled();
  expect(menus[0].items[0].icon).toBeNull();
  await visitor.reload();
  await expect(link.locator("svg[data-icon]")).toHaveCount(0);
  await expect(link.locator("svg")).toHaveCount(0);
  await context.close();
});
