import { expect, test, type Page } from "@playwright/test";
import { startPublicApi } from "../public-api-fixture";

let closeApi: (() => Promise<void>) | undefined;
test.beforeAll(async () => { closeApi = await startPublicApi(() => null); });
test.afterAll(async () => { await closeApi?.(); });

const initialUser = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho", role: "user" };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");

async function setup(page: Page, completed = false, remindAt: string | null = null) {
  let user: typeof initialUser & { avatarUrl?: string; onboarding: { nameProvided: boolean; remindAt: string | null } } | null = null;
  let deferWrites = 0;
  let registrations = 0;
  let failAvatar = false;
  let profileWrites = 0;
  let avatarWrites = 0;
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/auth/csrf") return route.fulfill({ json: { token: "test-csrf" } });
    if (path === "/api/v1/auth/register" || path === "/api/v1/auth/login") {
      expect(request.postDataJSON()).toEqual({ username: "Tonho", password: "senha-segura" });
      if (path.endsWith("register")) registrations++;
      user ??= { ...initialUser, ...(completed ? { avatarUrl: `/api/v1/avatars/${initialUser.id}.webp` } : {}), onboarding: { nameProvided: completed, remindAt } };
      return route.fulfill({ json: { user } });
    }
    if (path === "/api/v1/me/onboarding/defer") {
      deferWrites++;
      expect(request.method()).toBe("POST");
      user = { ...user!, onboarding: { ...user!.onboarding, remindAt: new Date(Date.now() + 48 * 3600000).toISOString() } };
      return route.fulfill({ json: { user } });
    }
    if (path === "/api/v1/me/profile") {
      profileWrites++;
      expect(request.headers()["x-csrf-token"]).toBe("test-csrf");
      user = { ...user!, displayName: request.postDataJSON().displayName, onboarding: { ...user!.onboarding, nameProvided: true } };
      return route.fulfill({ json: { user } });
    }
    if (path === "/api/v1/me/avatar") {
      avatarWrites++;
      expect(request.method()).toBe("PUT");
      expect(request.headers()["content-type"]).toBe("image/png");
      expect(request.postDataBuffer()).toEqual(png);
      if (failAvatar) return route.fulfill({ status: 503, json: { error: { message: "Não foi possível salvar a foto." } } });
      user = { ...user!, avatarUrl: `/api/v1/avatars/${initialUser.id}.webp` };
      return route.fulfill({ json: { user } });
    }
    if (path.startsWith("/api/v1/avatars/")) return route.fulfill({ contentType: "image/png", body: png });
    if (path === "/api/v1/me") return route.fulfill({ json: { user } });
    return route.continue();
  });
  return { deferWrites: () => deferWrites, counts: () => ({ registrations, profileWrites, avatarWrites }), failAvatar: (value: boolean) => { failAvatar = value; } };
}

async function authenticate(page: Page, register = true) {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  if (register) await dialog.getByRole("button", { name: "Cadastre-se", exact: true }).click();
  await dialog.getByLabel("Nome de usuário", { exact: true }).fill("Tonho");
  await dialog.getByLabel("Senha", { exact: true }).fill("senha-segura");
  await dialog.getByRole("button", { name: register ? "Criar conta" : "Entrar", exact: true }).click();
}

test("cadastro permite escolher nome e avatar com prévia e mantém o perfil após recarregar", async ({ page }) => {
  const state = await setup(page);
  await authenticate(page);
  const dialog = page.getByRole("dialog", { name: "Como você quer aparecer?" });
  await expect(dialog.getByLabel("Nome", { exact: true })).toHaveValue("Tonho");
  await dialog.getByLabel("Nome", { exact: true }).fill("  Tonho da comunidade  ");
  await dialog.getByLabel("Escolher avatar").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await expect(dialog.getByAltText("Seu avatar")).toHaveAttribute("src", /^blob:/);
  expect(state.counts()).toEqual({ registrations: 1, profileWrites: 0, avatarWrites: 0 });
  await dialog.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Conta de Tonho da comunidade" }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Conta de Tonho da comunidade" }).first()).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(state.counts()).toEqual({ registrations: 1, profileWrites: 1, avatarWrites: 1 });
});

test("onboarding pode ser pulado sem alterar o perfil e não reaparece ao recarregar", async ({ page }) => {
  const state = await setup(page);
  await authenticate(page);
  const dialog = page.getByRole("dialog", { name: "Como você quer aparecer?" });
  await dialog.getByRole("button", { name: "Agora não" }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Conta de Tonho" }).first()).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(state.counts()).toEqual({ registrations: 1, profileWrites: 0, avatarWrites: 0 });
  expect(state.deferWrites()).toBe(1);
});

test("perfil incompleto volta a pedir nome e foto depois de 48 horas", async ({ page }) => {
  await page.clock.install();
  await setup(page);
  await authenticate(page, false);
  const dialog = page.getByRole("dialog", { name: "Como você quer aparecer?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Agora não" }).click();
  await expect(dialog).toHaveCount(0);
  await page.clock.fastForward(48 * 3600000 - 60000);
  await expect(dialog).toHaveCount(0);
  await page.clock.fastForward(120000);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Nome", { exact: true })).toHaveValue("Tonho");
});

for (const closeWith of ["Fechar", "Escape"]) {
  test(`fechar com ${closeWith} também adia por 48 horas`, async ({ page }) => {
    const state = await setup(page);
    await authenticate(page, false);
    const dialog = page.getByRole("dialog", { name: "Como você quer aparecer?" });
    await expect(dialog).toBeVisible();
    if (closeWith === "Escape") await page.keyboard.press("Escape");
    else await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: "Conta de Tonho" }).first()).toBeVisible();
    await expect(dialog).toHaveCount(0);
    expect(state.deferWrites()).toBe(1);
  });
}

test("permite salvar apenas o nome e mantém a foto para o próximo lembrete", async ({ page }) => {
  const state = await setup(page);
  await authenticate(page);
  const dialog = page.getByRole("dialog", { name: "Como você quer aparecer?" });
  await dialog.getByLabel("Nome", { exact: true }).fill("Tonho Público");
  await dialog.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Conta de Tonho Público" }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Conta de Tonho Público" }).first()).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(state.counts()).toEqual({ registrations: 1, profileWrites: 1, avatarWrites: 0 });
  expect(state.deferWrites()).toBe(1);
});

test("permite salvar apenas a foto mantendo o nome exibido", async ({ page }) => {
  const state = await setup(page);
  await authenticate(page);
  const dialog = page.getByRole("dialog", { name: "Como você quer aparecer?" });
  await expect(dialog.getByLabel("Nome", { exact: true })).toHaveValue("Tonho");
  await dialog.getByLabel("Escolher avatar").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await dialog.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.counts()).toEqual({ registrations: 1, profileWrites: 1, avatarWrites: 1 });
});

test("remover a foto antes de enviar não envia avatar", async ({ page }) => {
  const state = await setup(page);
  await authenticate(page);
  const dialog = page.getByRole("dialog", { name: "Como você quer aparecer?" });
  await dialog.getByLabel("Escolher avatar").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await dialog.getByRole("button", { name: "Remover foto" }).click();
  await expect(dialog.getByAltText("Seu avatar")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.counts()).toEqual({ registrations: 1, profileWrites: 1, avatarWrites: 0 });
});

test("login de conta completa não abre o onboarding", async ({ page }) => {
  const state = await setup(page, true);
  await authenticate(page, false);
  await expect(page.getByRole("button", { name: "Conta de Tonho" }).first()).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(state.counts().registrations).toBe(0);
});

test("falha de upload preserva nome e foto para retentar sem cadastrar novamente", async ({ page }) => {
  const state = await setup(page);
  state.failAvatar(true);
  await authenticate(page);
  const dialog = page.getByRole("dialog", { name: "Como você quer aparecer?" });
  await dialog.getByLabel("Nome", { exact: true }).fill("Tonho Público");
  await dialog.getByLabel("Escolher avatar").setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: png });
  await dialog.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByText("Não foi possível salvar a foto.", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Nome", { exact: true })).toHaveValue("Tonho Público");
  await expect(dialog.getByAltText("Seu avatar")).toBeVisible();
  state.failAvatar(false);
  await dialog.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.counts().registrations).toBe(1);
  expect(state.counts().avatarWrites).toBe(2);
});

test("foto inválida e nome em branco não são enviados", async ({ page }) => {
  const state = await setup(page);
  await authenticate(page);
  const dialog = page.getByRole("dialog", { name: "Como você quer aparecer?" });
  await dialog.getByLabel("Escolher avatar").setInputFiles({ name: "avatar.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  await expect(page.getByText("Escolha uma imagem JPG, PNG ou WebP.", { exact: true })).toBeVisible();
  await dialog.getByLabel("Nome", { exact: true }).fill("   ");
  await dialog.getByRole("button", { name: "Salvar e continuar" }).click();
  await expect(page.getByText("Digite um nome de 1 a 40 caracteres válidos.", { exact: true })).toBeVisible();
  expect(state.counts()).toEqual({ registrations: 1, profileWrites: 0, avatarWrites: 0 });
});


test("lembrete distante não estoura o timer nem bloqueia navegação antes do prazo", async ({ page }) => {
  const now = Date.parse("2026-11-21T00:00:00.000Z"), deadline = Date.parse("2027-01-01T00:00:00.000Z");
  await page.clock.install({time:new Date(now)});
  await page.clock.pauseAt(new Date(now+1000));
  const state = await setup(page,false,new Date(deadline).toISOString());
  await authenticate(page,false);
  const dialog = page.getByRole("dialog",{name:"Como você quer aparecer?"});
  await expect(page.getByRole("button",{name:"Conta de Tonho",exact:true}).first()).toBeVisible();
  await page.clock.runFor(1000);
  await expect(dialog).toHaveCount(0);
  let remaining = deadline-now-2001;
  while (remaining > 0) {
    const step = Math.min(remaining, 2_147_483_647);
    await page.clock.fastForward(step);
    remaining -= step;
  }
  await expect(dialog).toHaveCount(0);
  await page.clock.fastForward(1);
  await expect(dialog).toBeVisible();
  expect(state.counts()).toEqual({registrations:0,profileWrites:0,avatarWrites:0});
  expect(state.deferWrites()).toBe(0);
});
