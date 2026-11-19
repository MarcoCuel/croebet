import { expect, test } from "@playwright/test";

const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho Público", role: "user" };

test("menu abre perfil pelo usuário e /perfil redireciona para a mesma conta", async ({ page }) => {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { user } }));
  await page.route("**/api/v1/profiles/*", route => route.fulfill({ json: { username: user.username, displayName: user.displayName } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Conta de Tonho Público" }).first().click();
  await page.getByRole("menuitem", { name: "Perfil" }).click();
  await expect(page).toHaveURL(/\/perfil\/Tonho$/);
  await expect(page.getByRole("heading", { name: "Tonho Público" })).toBeVisible();
  await expect(page.getByText("@Tonho", { exact: true })).toBeVisible();
  await page.goto("/perfil");
  await expect(page).toHaveURL(/\/perfil\/Tonho$/);
});

test("perfil é público e distingue conta inexistente de serviço indisponível", async ({ page }) => {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { user: null } }));
  let status = 503;
  await page.route("**/api/v1/profiles/**", route => route.fulfill({ status, json: status === 200 ? { username: "Tonho", displayName: "Tonho Público" } : {} }));
  await page.goto("/perfil/TONHO");
  await expect(page.getByRole("heading", { name: "Não foi possível carregar este perfil." })).toBeVisible();
  status = 200;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("heading", { name: "Tonho Público" })).toBeVisible();
  status = 404;
  await page.goto("/perfil/inexistente");
  await expect(page.getByRole("heading", { name: "Perfil não encontrado." })).toBeVisible();
  await page.goto("/perfil");
  await expect(page.getByRole("button", { name: "Entrar", exact: true }).last()).toBeVisible();
});

test("edição da foto aparece apenas no próprio perfil e abre a seleção diretamente", async ({ page }, testInfo) => {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { user } }));
  await page.route("**/api/v1/profiles/**", route => {
    const own = new URL(route.request().url()).pathname.toLowerCase().endsWith("/tonho");
    return route.fulfill({ json: own ? { username: "Tonho", displayName: user.displayName } : { username: "Outro", displayName: "Outra pessoa" } });
  });
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
    await page.route("**/api/v1/profiles/*", route => route.fulfill({ json: { username: "Tonho", displayName: user.displayName } }));
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
    await route.fulfill({ json: { user: { ...user, avatarUrl: avatar } } });
  });
  await page.route("**/api/v1/profiles/*", route => route.fulfill({ json: { username: "Tonho", displayName: user.displayName, avatarUrl: avatar } }));
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
  await page.reload();
  await expect(page.locator("main img")).toHaveAttribute("src", avatarUrl);
  await expect(page.getByRole("button", { name: "Alterar foto de perfil", exact: true })).toHaveCount(0);
});
