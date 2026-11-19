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
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Conta", exact: true }).click();
  await dialog.getByLabel("Nome de usuário", { exact: true }).fill("Tonho");
  await dialog.getByRole("button", { name: "Salvar usuário", exact: true }).click();
  await expect(dialog.getByLabel("Nome de usuário", { exact: true })).toHaveValue("Tonho");
  await expect(dialog.getByLabel("Nome de usuário", { exact: true })).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Salvar usuário", exact: true })).toBeDisabled();
  await expect(dialog.getByText(/Você poderá alterar seu usuário novamente em/)).toBeVisible();
  await expect(dialog.getByLabel("Nome", { exact: true })).toHaveValue("Tonho Público");
  await expect(dialog.getByLabel("Nome", { exact: true })).toBeEditable();
});
