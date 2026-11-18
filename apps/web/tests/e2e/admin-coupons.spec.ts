import { expect, test } from "@playwright/test";

test("admin cria cupom e consulta resgates sem alterar carteira", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("croebet:demo-username", "AdminTeste"));
  await page.goto("/admin/cupons");
  await page.getByRole("link", { name: "Gerenciar CROELIVE", exact: true }).click();
  await expect(page.getByRole("cell", { name: "@atinha", exact: true })).toBeVisible();
  await page.getByLabel("Buscar usuário nos resgates").fill("inexistente");
  await expect(page.getByText("Nenhum usuário encontrado.")).toBeVisible();
  await page.goto("/admin/cupons");
  await page.getByRole("link", { name: "Novo cupom", exact: true }).click();
  await page.getByLabel("Código do cupom").fill("TESTELIVE");
  await page.getByLabel("Croins por resgate").fill("125");
  await page.getByLabel("Limite total de resgates").fill("10");
  await page.getByRole("button", { name: "Salvar cupom", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/cupons\/(?!novo)[^/]+$/);
  await page.reload();
  await expect(page.getByLabel("Código do cupom")).toHaveValue("TESTELIVE");
  await page.getByLabel("Cupom pausado").check();
  await page.getByRole("button", { name: "Salvar cupom", exact: true }).click();
  await expect(page.getByText("Pausado", { exact: true })).toBeVisible();
  await page.goto("/admin/cupons");
  await page.getByLabel("Buscar cupons", { exact: true }).fill("TESTELIVE");
  await expect(page.getByRole("heading", { name: "TESTELIVE", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "CROELIVE", exact: true })).toHaveCount(0);
});
