import { expect, test } from "@playwright/test";

test("visitante não vê conquistas e acesso direto volta ao início", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  await expect(page.locator('a[href="/conquistas"]')).toHaveCount(0);
  await page.goto("/conquistas");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Conquistas", exact: true })).toHaveCount(0);
});

test("conquistas persistem com sessão e deixam de aparecer ao sair", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome de usuário").fill("Conquistador");
  await dialog.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("contentinfo").getByRole("link", { name: "Conquistas" }).click();
  await expect(page.getByRole("heading", { name: "Conquistas", exact: true })).toBeAttached();
  await page.reload();
  await expect(page.getByText("Conquistas liberadas")).toBeVisible();
  await page.getByRole("button", { name: "Conta de Conquistador" }).last().click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator('a[href="/conquistas"]')).toHaveCount(0);
  await page.goBack();
  await expect(page.getByText("Conquistas liberadas")).toHaveCount(0);
});
