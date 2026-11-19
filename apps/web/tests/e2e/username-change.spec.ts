import { expect, test } from "@playwright/test";

test("configurações salvam usuário e exibem o bloqueio sem alterar o nome público", async ({ page }) => {
  let user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "tonho", displayName: "Tonho Público", role: "user", usernameChangeAvailableAt: null as string | null };
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/auth/csrf") return route.fulfill({ json: { token: "test-csrf" } });
    if (path === "/api/v1/me/username") {
      expect(route.request().method()).toBe("PATCH");
      expect(route.request().headers()["x-csrf-token"]).toBe("test-csrf");
      expect(route.request().postDataJSON()).toEqual({ username: "Tonho" });
      user = { ...user, username: "Tonho", usernameChangeAvailableAt: new Date(Date.now() + 30 * 86400000).toISOString() };
    }
    return route.fulfill({ json: { user } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Conta de Tonho Público" }).first().click();
  await page.getByRole("menuitem", { name: "Configurações" }).click();
  const dialog = page.getByRole("dialog").first();
  await dialog.getByRole("button", { name: "Conta", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Sair da conta", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Excluir", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Editar nome de usuário", exact: true }).click();
  const editor = page.getByRole("dialog").last();
  await editor.getByLabel("Nome de usuário", { exact: true }).fill("Tonho");
  await editor.getByRole("button", { name: "Salvar usuário", exact: true }).click();
  await expect(dialog.getByText("@Tonho", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Editar nome de usuário", exact: true }).click();
  await expect(editor.getByLabel("Nome de usuário", { exact: true })).toHaveValue("Tonho");
  await expect(editor.getByLabel("Nome de usuário", { exact: true })).toBeDisabled();
  await expect(editor.getByRole("button", { name: "Salvar usuário", exact: true })).toBeDisabled();
  await expect(editor.getByText(/Você poderá alterar seu usuário novamente em/)).toBeVisible();
  await editor.getByRole("button", { name: "Fechar", exact: true }).click();
  await dialog.getByRole("button", { name: "Editar nome", exact: true }).click();
  await expect(editor.getByLabel("Nome", { exact: true })).toHaveValue("Tonho Público");
  await expect(editor.getByLabel("Nome", { exact: true })).toBeEditable();
});

test("excluir conta exige senha, permite cancelar e encerra a sessão após sucesso", async ({ page }) => {
  let deleted = false;
  let attempts = 0;
  const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho Público", role: "user", usernameChangeAvailableAt: null };
  await page.route("**/api/v1/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/auth/csrf") return route.fulfill({ json: { token: "test-csrf" } });
    if (path === "/api/v1/me" && request.method() === "DELETE") {
      attempts++;
      expect(request.headers()["x-csrf-token"]).toBe("test-csrf");
      if (request.postDataJSON().password !== "senha-correta") return route.fulfill({ status: 401, json: { error: { code: "INVALID_CREDENTIALS", message: "Senha incorreta." } } });
      deleted = true;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: { user: deleted ? null : user } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Conta de Tonho Público" }).first().click();
  await page.getByRole("menuitem", { name: "Configurações" }).click();
  const settings = page.getByRole("dialog").first();
  await settings.getByRole("button", { name: "Conta", exact: true }).click();
  await settings.getByRole("button", { name: "Excluir", exact: true }).click();
  const confirmation = page.getByRole("dialog").last();
  await expect(confirmation.getByRole("button", { name: "Excluir conta", exact: true })).toBeDisabled();
  await confirmation.getByRole("button", { name: "Fechar", exact: true }).click();
  expect(attempts).toBe(0);
  await settings.getByRole("button", { name: "Excluir", exact: true }).click();
  await confirmation.getByLabel("Senha atual", { exact: true }).fill("errada");
  await confirmation.getByRole("button", { name: "Excluir conta", exact: true }).click();
  await expect(page.getByText("Senha incorreta.", { exact: true })).toBeVisible();
  await expect(confirmation).toBeVisible();
  await confirmation.getByLabel("Senha atual", { exact: true }).fill("senha-correta");
  await confirmation.getByRole("button", { name: "Excluir conta", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Conta de Tonho Público" })).toHaveCount(0);
  expect(deleted).toBe(true);
});
