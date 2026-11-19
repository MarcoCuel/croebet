import { createServer, type Server } from "node:http";
import { expect, test } from "@playwright/test";

const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho Público", role: "user" };

// Server rendering must be exercised against an HTTP fixture, not page.route.
// Run with --config playwright.session.config.ts.
let api: Server;
let sessionActive = true;
let profileStatus = 200;
let storedAvatar: string | null = null;
test.beforeAll(async () => {
  api = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.setHeader("cache-control", "no-store");
    if (request.url === "/api/v1/me") {
      response.end(JSON.stringify({ user: sessionActive ? { ...user, avatarUrl: storedAvatar } : null }));
      return;
    }
    const name = decodeURIComponent(request.url?.split("/").at(-1) ?? "");
    response.statusCode = profileStatus;
    response.end(JSON.stringify(profileStatus === 200
      ? { username: name.toLowerCase() === "tonho" ? "Tonho" : "Outro", displayName: name.toLowerCase() === "tonho" ? user.displayName : "Outra pessoa", avatarUrl: storedAvatar }
      : {}));
  });
  await new Promise<void>((resolve, reject) => { api.once("error", reject); api.listen(3201, "127.0.0.1", resolve); });
});
test.beforeEach(async ({ context }) => {
  sessionActive = true; profileStatus = 200; storedAvatar = null;
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
  await expect(page.locator("main img")).toHaveAttribute("src", avatarUrl);
  await page.reload();
  await expect(page.locator("main img")).toHaveAttribute("src", avatarUrl);
  signedIn = false;
  sessionActive = false;
  await page.reload();
  await expect(page.locator("main img")).toHaveAttribute("src", avatarUrl);
  await expect(page.getByRole("button", { name: "Alterar foto de perfil", exact: true })).toHaveCount(0);
});


test.describe("perfil na primeira renderização", () => {
  test.use({ javaScriptEnabled: false });
  test("perfil público e redirecionamentos já funcionam sem JavaScript", async ({ page, context }) => {
    sessionActive = false;
    await context.clearCookies();
    await page.goto("/perfil/TONHO");
    await expect(page).toHaveURL(/\/perfil\/Tonho$/);
    await expect(page.getByRole("heading", { name: user.displayName })).toBeVisible();
    await expect(page.getByText("Carregando perfil…", { exact: true })).toHaveCount(0);
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
