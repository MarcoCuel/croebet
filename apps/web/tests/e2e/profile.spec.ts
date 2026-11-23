import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho Público", role: "user" };

// Server rendering must be exercised against an HTTP fixture, not page.route.
// Run with --config playwright.session.config.ts.
const activity = { timeZone: "America/Sao_Paulo", days: Array.from({ length: 391 }, (_, index) => ({ date: new Date(Date.UTC(2025, 9, 26 + index)).toISOString().slice(0, 10), games: index === 390 ? 3 : 0, wins: index === 390 ? 1 : 0, dailyBonuses: index >= 389 ? 1 : 0, coupons: index === 390 ? 1 : 0 })) };
let api: Server;
let hasActivity = true;
let sessionActive = true;
let profileStatus = 200;
let storedAvatar: string | null = null;
test.beforeAll(async () => {
  api = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.setHeader("cache-control", "no-store");
    if (request.url?.startsWith("/api/v1/avatars/")) {
      response.setHeader("content-type", "image/png");
      response.end(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64"));
      return;
    }
    if (request.url === "/api/v1/me") {
      response.end(JSON.stringify({ user: sessionActive ? { ...user, avatarUrl: storedAvatar } : null }));
      return;
    }
    if (request.url?.includes("/matches?")) {
      response.end(JSON.stringify({ items: [], hasMore: false }));
      return;
    }
    const name = decodeURIComponent(request.url?.split("/").at(-1) ?? "");
    response.statusCode = profileStatus;
    response.end(JSON.stringify(profileStatus === 200
      ? { username: name.toLowerCase() === "tonho" ? "Tonho" : "Outro", displayName: name.toLowerCase() === "tonho" ? user.displayName : "Outra pessoa", avatarUrl: storedAvatar, activity: hasActivity ? activity : { ...activity, days: activity.days.map(day => ({ ...day, games: 0, wins: 0, dailyBonuses: 0, coupons: 0 })) } }
      : {}));
  });
  await new Promise<void>((resolve, reject) => { api.once("error", reject); api.listen(3201, "127.0.0.1", resolve); });
});
test.beforeEach(async ({ context }) => {
  hasActivity = true; sessionActive = true; profileStatus = 200; storedAvatar = null;
  await context.addCookies([{ name: "croebet-session", value: "profile-test", url: "http://127.0.0.1:3100" }]);
});
test.afterAll(async () => { if (api?.listening) await new Promise<void>((resolve, reject) => api.close(error => error ? reject(error) : resolve())); });

test("menu abre perfil pelo usuário e /perfil redireciona para a mesma conta", async ({ page }) => {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { user } }));
  await page.goto("/");
  await page.locator("header").getByRole("button", { name: "Conta de Tonho Público" }).click();
  await page.getByRole("menuitem", { name: "Perfil" }).click();
  await expect(page).toHaveURL(/\/perfil\/Tonho$/);
  await expect(page.getByRole("heading", { name: "Tonho Público" })).toBeVisible();
  await expect(page.getByText("@Tonho", { exact: true })).toBeVisible();
  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/perfil\/Tonho$/);
});

test("perfil é público e distingue conta inexistente de serviço indisponível", async ({ page }) => {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { user: null } }));
  sessionActive = false;
  profileStatus = 503;
  await page.goto("/perfil/TONHO");
  await expect(page.getByRole("heading", { name: "Não foi possível carregar este perfil." })).toBeVisible();
  profileStatus = 200;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("heading", { name: "Tonho Público" })).toBeVisible();
  profileStatus = 404;
  await page.goto("/perfil/inexistente");
  await expect(page.getByRole("heading", { name: "Perfil não encontrado." })).toBeVisible();
  await page.goto("/perfil");
  await expect(page.getByRole("button", { name: "Entrar", exact: true }).last()).toBeVisible();
});

test("edição da foto aparece apenas no próprio perfil e abre a seleção diretamente", async ({ page }, testInfo) => {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { user } }));
  await page.goto("/perfil/tonho");
  const edit = page.getByRole("button", { name: "Alterar foto de perfil", exact: true });
  if (testInfo.project.name === "desktop") {
    await expect(edit).toHaveCSS("opacity", "0");
    await page.locator("main [data-slot=avatar]").hover();
  }
  await expect(edit).toHaveCSS("opacity", "1");
  await edit.focus();
  await expect(edit).toHaveCSS("opacity", "1");
  const chooserPromise = page.waitForEvent("filechooser");
  await edit.press("Enter");
  const chooser = await chooserPromise;
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await chooser.element().getAttribute("accept")).toBe("image/jpeg,image/png,image/webp");
  await page.goto("/perfil/outro");
  await expect(page.getByRole("heading", { name: "Outra pessoa", exact: true })).toBeVisible();
  await expect(edit).toHaveCount(0);
});

for (const spelling of ["tonho", "TONHO", "ToNhO"]) {
  test(`perfil corrige a URL ${spelling} para a grafia salva`, async ({ page }) => {
    await page.route("**/api/v1/me", route => route.fulfill({ json: { user: null } }));
    await page.goto(`/perfil/${spelling}`);
    await expect(page).toHaveURL(/\/perfil\/Tonho$/);
    await expect(page.getByRole("heading", { name: user.displayName })).toBeVisible();
    await expect(page.getByText("@Tonho", { exact: true })).toBeVisible();
  });
}


test("upload direto atualiza a foto e ela continua no perfil após recarregar", async ({ page }) => {
  const avatarUrl = "/api/v1/avatars/93089d02-0b34-4b78-9d3e-f2679c190b5b.webp";
  let avatar: string | null = null;
  let signedIn = true;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");
  await page.route("**/api/v1/me", route => route.fulfill({ json: { user: signedIn ? { ...user, avatarUrl: avatar } : null } }));
  await page.route("**/api/v1/auth/csrf", route => route.fulfill({ json: { token: "test-csrf" } }));
  await page.route("**/api/v1/me/avatar", async route => {
    expect(route.request().method()).toBe("PUT");
    expect(route.request().headers()["content-type"]).toBe("image/png");
    expect(route.request().postDataBuffer()).toEqual(png);
    avatar = avatarUrl;
    storedAvatar = avatarUrl;
    await route.fulfill({ json: { user: { ...user, avatarUrl: avatar } } });
  });
  await page.route("**/api/v1/avatars/*", route => route.fulfill({ contentType: "image/png", body: png }));
  await page.goto("/perfil/Tonho");
  await expect(page.getByRole("heading", { name: user.displayName })).toBeVisible();
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Alterar foto de perfil", exact: true }).focus();
  await page.getByRole("button", { name: "Alterar foto de perfil", exact: true }).press("Enter");
  await (await chooserPromise).setFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Foto atualizada.", { exact: true })).toBeVisible();
  await expect(page.locator("main img")).toHaveJSProperty("src", new URL(avatarUrl, page.url()).href);
  await page.reload();
  await expect(page.locator("main img")).toHaveJSProperty("src", new URL(avatarUrl, page.url()).href);
  signedIn = false;
  sessionActive = false;
  await page.reload();
  await expect(page.locator("main img")).toHaveJSProperty("src", new URL(avatarUrl, page.url()).href);
  await expect(page.getByRole("button", { name: "Alterar foto de perfil", exact: true })).toHaveCount(0);
});


test.describe("perfil na primeira renderização", () => {
  test.use({ javaScriptEnabled: false });
  test("perfil público e redirecionamentos já funcionam sem JavaScript", async ({ page, context }) => {
    sessionActive = false;
    await context.clearCookies();
    storedAvatar = "/api/v1/avatars/93089d02-0b34-4b78-9d3e-f2679c190b5b.webp";
    await page.goto("/perfil/TONHO");
    await expect(page).toHaveURL(/\/perfil\/Tonho$/);
    await expect(page.getByRole("heading", { name: user.displayName })).toBeVisible();
    await expect(page.getByText("Carregando perfil…", { exact: true })).toHaveCount(0);
    await expect(page.locator(`head link[rel="preload"][as="image"][href="${storedAvatar}"]`)).toHaveCount(1);
    await expect(page.locator("main img[data-slot=avatar-image]")).toHaveAttribute("src", storedAvatar);
    await expect(page.locator("main img[data-slot=avatar-image]")).toBeVisible();
    await expect(page.locator("main [data-slot=avatar-fallback]")).toBeHidden();
    await page.reload();
    await expect(page.getByText("@Tonho", { exact: true })).toBeVisible();
    profileStatus = 404;
    const response = await page.goto("/perfil/inexistente");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Perfil não encontrado." })).toBeVisible();
  });
  test("atalho /perfil redireciona no servidor para a conta autenticada", async ({ page }) => {
    await page.goto("/perfil");
    await expect(page).toHaveURL(/\/perfil\/Tonho$/);
    await expect(page.getByRole("heading", { name: user.displayName })).toBeVisible();
    await expect(page.getByText("Carregando perfil…", { exact: true })).toHaveCount(0);
  });
});


test("avatar com erro mostra fallback e uma nova foto volta a aparecer", async ({ page }) => {
  storedAvatar = "/api/v1/avatars/93089d02-0b34-4b78-9d3e-f2679c190b5b.webp";
  await page.route("**/api/v1/avatars/*", route => route.fulfill({ status: 404 }));
  await page.goto("/perfil/Tonho");
  await expect(page.locator("main [data-slot=avatar-fallback]")).toBeVisible();
  await expect(page.locator("main img")).toBeHidden();
  await page.unroute("**/api/v1/avatars/*");
  storedAvatar = "/api/v1/avatars/93089d02-0b34-4b78-9d3e-f2679c190b5c.webp";
  await page.reload();
  await expect(page.locator("main img")).toBeVisible();
  await expect(page.locator("main [data-slot=avatar-fallback]")).toBeHidden();
});


test("heatmap mostra histórico, detalhes por toque e navegação pelo teclado sem alargar a página", async ({ page }) => {
  await page.goto("/perfil/Tonho");
  const calendar = page.getByRole("region", { name: "Calendário de atividades" });
  await expect(calendar.getByRole("button")).toHaveCount(391);
  const latest = calendar.getByRole("button", { name: "20 de novembro de 2026: 3 partidas, 1 vitória, 1 bônus diário e 1 cupom.", exact: true });
  await expect(latest).toBeVisible();
  const background = await latest.evaluate(element => getComputedStyle(element).backgroundColor);
  await latest.hover();
  await expect(latest).toHaveCSS("background-color", background);
  await latest.click();
  await expect(page.getByRole("tooltip")).toHaveText("20 de novembro de 2026: 3 partidas, 1 vitória, 1 bônus diário e 1 cupom.");
  await expect(calendar.getByRole("button").first()).toHaveAccessibleName("26 de outubro de 2025: Nenhuma atividade.");
  await latest.focus();
  await latest.press("ArrowLeft");
  await expect(calendar.getByRole("button", { name: /^13 de novembro de 2026:/ })).toBeFocused();
  await page.keyboard.press("End");
  await expect(latest).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});


test("dias vazios mostram uma mensagem simples sem contagens zeradas", async ({ page }) => {
  hasActivity = false;
  await page.goto("/perfil/Tonho");
  const calendar = page.getByRole("region", { name: "Calendário de atividades" });
  await calendar.getByRole("button").last().click();
  await expect(page.getByRole("tooltip")).toHaveText("20 de novembro de 2026: Nenhuma atividade.");
});


test("dia com apenas bônus omite as atividades que não ocorreram", async ({ page }) => {
  await page.goto("/perfil/Tonho");
  const calendar = page.getByRole("region", { name: "Calendário de atividades" });
  await expect(calendar.getByRole("button", { name: /0 partidas|0 vitórias|0 bônus|0 cupons/ })).toHaveCount(0);
  await calendar.getByRole("button", { name: "19 de novembro de 2026: 1 bônus diário.", exact: true }).click();
  await expect(page.getByRole("tooltip")).toHaveText("19 de novembro de 2026: 1 bônus diário.");
});


test("perfil lista somente partidas, pagina e permite retentar falhas", async ({ page }) => {
  let fail = true;
  await page.route("**/api/v1/profiles/Tonho/matches?*", route => {
    if (fail) return route.fulfill({ status: 503, json: {} });
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    return route.fulfill({ json: {
      items: Array.from({ length: offset ? 1 : 20 }, (_, index) => ({
        gameName: offset ? "Love Letter" : "Flip 7", gameImageUrl: "/cover-fixture.svg", id: `game:${offset + index}`, kind: "game", description: `${offset ? "Love Letter" : "Flip 7"} · Partida concluída`,
        createdAt: "2026-11-23T01:00:00.000Z", amount: null,
      })), hasMore: offset === 0,
    } });
  });
  await page.route("**/cover-fixture.svg", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="purple"/></svg>' }));
  await page.goto("/perfil/Tonho");
  await expect(page.getByRole("heading", { name: "Partidas jogadas" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Não foi possível carregar o histórico.");
  fail = false;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Flip 7 · Partida concluída", { exact: true })).toHaveCount(20);
  await expect(page.getByRole("img", { name: "Capa de Flip 7", exact: true })).toHaveCount(20);
  await expect(page.getByRole("img", { name: "Capa de Flip 7", exact: true }).first()).toHaveJSProperty("naturalWidth", 48);
  await page.getByRole("button", { name: "Carregar mais" }).click();
  await expect(page.getByText("Love Letter · Partida concluída", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Carregar mais" })).toHaveCount(0);
  await expect(page.locator('main a[href*="partida="]')).toHaveCount(0);
  await expect(page.getByRole("main").getByText(/Croins/)).toHaveCount(0);
  await page.goto("/perfil/outro");
  await expect(page.getByText("Nenhuma partida registrada ainda.")).toBeVisible();
  await expect(page.getByText("Flip 7 · Partida concluída", { exact: true })).toHaveCount(0);
});
