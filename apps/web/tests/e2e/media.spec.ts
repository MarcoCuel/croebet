import { createServer, type Server } from "node:http";
import { defaultSeoSettings, type MediaItem } from "@croebet/shared";
import { expect, test } from "@playwright/test";
const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Admin", displayName: "Admin", role: "admin" };
const item: MediaItem = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5c", url: "/api/v1/media/93089d02-0b34-4b78-9d3e-f2679c190b5c.webp", name: "capa.png", width: 600, height: 300, bytes: 1024, createdAt: "2026-11-20T12:00:00Z" };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
let items: MediaItem[] = [], inUse = false;
let settings = structuredClone(defaultSeoSettings);
let savedGame: Record<string, unknown> | null = null;
let api: Server;
function respond(path: string, method = "GET", body: Record<string, unknown> = {}): { status: number; data: unknown } {
  const url = new URL(path, "http://localhost"); path = url.pathname;
  if (path === "/api/v1/seo") return { status: 200, data: defaultSeoSettings };
  if (path === "/api/v1/me") return { status: 200, data: { user } };
  if (path === "/api/v1/auth/csrf") return { status: 200, data: { token: "fixture" } };
  if (path === "/api/v1/navigation") return { status: 200, data: { main: [], footer: [] } };
  if (path === "/api/v1/economy") return { status: 200, data: { initialBalance: 30, dailyReward: 10, dailyResetTimeZone: "America/Sao_Paulo", suggestedBets: [1,5,10,50], defaultBet: 5 } };
  if (path === "/api/v1/rewards/daily") return { status: 200, data: { balance: 30, eligible: true, lastClaimAt: null, nextClaimAt: null, serverNow: new Date().toISOString() } };
  if (path === "/api/v1/admin/media") {
    if (method === "POST") { items = [item]; return { status: 200, data: item }; }
    return { status: 200, data: { items: items.filter(i => i.name.includes(url.searchParams.get("q") ?? "")), hasMore: false } };
  }
  if (path.startsWith("/api/v1/admin/media/") && method === "DELETE") {
    if (inUse) return { status: 409, data: { error: { message: "Esta imagem está em uso." } } };
    items = []; return { status: 200, data: { ok: true } };
  }
  if (path === "/api/v1/admin/seo") { if (method === "PATCH") settings = { ...settings, ...body, version: settings.version + 1 }; return { status: 200, data: settings }; }
  if (path === "/api/v1/admin/games" && method === "POST") { savedGame = body; return { status: 200, data: { ...body, id: item.id, version: 1 } }; }
  if (path === "/api/v1/admin/games") return { status: 200, data: { items: [] } };
  return { status: 404, data: {} };
}
test.beforeAll(async () => {
  api = createServer((request, response) => { const result = respond(request.url ?? ""); response.writeHead(result.status, { "content-type": "application/json" }); response.end(JSON.stringify(result.data)); });
  await new Promise<void>((resolve, reject) => { api.once("error", reject); api.listen(3201, "127.0.0.1", resolve); });
});
test.afterAll(async () => { if (api?.listening) await new Promise<void>(resolve => api.close(() => resolve())); });
test.beforeEach(async ({ page, context }) => {
  items = []; inUse = false; savedGame = null; settings = structuredClone(defaultSeoSettings);
  await context.addCookies([{ name: "croebet-session", value: "media-test", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/**", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.startsWith("/api/v1/media/")) { await route.fulfill({ status: 200, contentType: "image/png", body: png }); return; }
    const body = request.headers()["content-type"]?.includes("application/json") ? request.postDataJSON() ?? {} : {};
    const result = respond(url.pathname + url.search, request.method(), body);
    await route.fulfill({ status: result.status, json: result.data });
  });
});
test("biblioteca envia, busca, visualiza e confirma exclusão, preservando imagem em uso", async ({ page }) => {
  await page.goto("/admin/midia");
  await expect(page.getByText("Nenhuma imagem enviada.")).toBeVisible();
  await page.getByLabel("Enviar imagem", { exact: true }).setInputFiles({ name: "capa.png", mimeType: "image/png", buffer: png });
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "capa.png" })).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByPlaceholder("Buscar imagens").fill("ausente");
  await expect(page.getByText("Nenhuma imagem encontrada.")).toBeVisible();
  await page.getByPlaceholder("Buscar imagens").fill("");
  await page.getByRole("button", { name: "Selecionar capa.png" }).click();
  inUse = true;
  await dialog.getByRole("button", { name: "Excluir imagem", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(page.getByText("Esta imagem está em uso.", { exact: true })).toBeVisible();
  inUse = false;
  await dialog.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("Nenhuma imagem enviada.")).toBeVisible();
});
test("capa de jogo reutiliza imagem e permite remover a seleção", async ({ page }) => {
  items = [item];
  await page.goto("/admin/jogos/novo");
  await page.getByRole("button", { name: "Selecionar imagem", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Selecionar imagem", exact: true });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds).not.toBeNull();
  expect(bounds!.width).toBeCloseTo(Math.min(1024, viewport.width - 32), 0);
  expect(bounds!.height).toBeCloseTo(Math.min(704, viewport.height * 0.85), 0);
  expect(bounds!.x).toBeGreaterThanOrEqual(16);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  await page.getByRole("button", { name: "Selecionar capa.png" }).click();
  await expect(page.getByRole("button", { name: "Alterar imagem", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Remover imagem", exact: true }).click();
  await page.getByRole("button", { name: "Selecionar imagem", exact: true }).first().click();
  await page.getByRole("button", { name: "Selecionar capa.png" }).click();
  await page.getByLabel("Nome do jogo", { exact: true }).fill("Teste");
  await page.getByLabel("Endereço do jogo", { exact: true }).fill("teste");
  await page.getByRole("button", { name: "Criar jogo", exact: true }).click();
  await expect(page).toHaveURL("/admin/jogos"); expect(savedGame?.imageUrl).toBe(item.url);
});
test("configurações selecionam imagem existente no modal de edição", async ({ page }) => {
  items = [item]; await page.goto("/admin/configuracoes");
  await page.getByRole("button", { name: "Editar imagem de compartilhamento", exact: true }).first().click();
  await page.getByRole("button", { name: "Selecionar imagem", exact: true }).click();
  await page.getByRole("button", { name: "Selecionar capa.png" }).click();
  await page.getByRole("button", { name: "Salvar alterações", exact: true }).click();
  await expect(page.getByText("Configurações salvas.", { exact: true })).toBeVisible(); expect(settings.image).toBe(item.url);
});

test("endereço do jogo acompanha nome ao sair e normaliza edição manual sem sobrescrevê-la", async ({ page }) => {
  await page.goto("/admin/jogos/novo");
  const name = page.getByLabel("Nome do jogo", { exact: true });
  const slug = page.getByLabel("Endereço do jogo", { exact: true });
  await name.fill("Jogo de AÇÃO");
  await name.press("Tab");
  await expect(slug).toHaveValue("jogo-de-acao");
  // Focar o endereço gerado sem editá-lo não o torna personalizado.
  await slug.press("Tab");
  await name.fill("Outro Jogo");
  await name.press("Tab");
  await expect(slug).toHaveValue("outro-jogo");
  await slug.fill("  Meu Endereço   Único!  ");
  await slug.press("Tab");
  await expect(slug).toHaveValue("meu-endereco-unico");
  await name.fill("Nome final");
  await name.press("Tab");
  await expect(slug).toHaveValue("meu-endereco-unico");
  await page.getByRole("button", { name: "Criar jogo", exact: true }).click();
  await expect.poll(() => savedGame?.slug).toBe("meu-endereco-unico");
});

test("criar jogo com Enter no nome gera endereço mesmo sem sair do campo", async ({ page }) => {
  await page.goto("/admin/jogos/novo");
  await page.getByLabel("Nome do jogo", { exact: true }).fill("Jogo Rápido");
  await page.getByLabel("Nome do jogo", { exact: true }).press("Enter");
  await expect.poll(() => savedGame?.slug).toBe("jogo-rapido");
});
