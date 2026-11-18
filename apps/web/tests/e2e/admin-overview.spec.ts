import { expect, test } from "@playwright/test";

test("visão geral filtra registros, mantém saldo atual e abre pendências", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("croebet:demo-username", "AdminTeste");
    const createdAt = new Date(Date.now() - 2 * 86400000).toISOString();
    localStorage.setItem("croebet:demo-wallet:adminteste", JSON.stringify({
      balance: 321, lastClaim: "", predictions: [{ id: "overview-bet", marketId: "peruca", market: "Ela vai começar a live de peruca?", outcome: "Sim", stake: 250, username: "adminteste", createdAt }],
      transactions: [{ id: "overview-bonus", description: "Bônus diário", amount: 67, balance: 321, createdAt }],
    }));
  });
  await page.goto("/admin");
  const overview = page.getByRole("region", { name: "Visão geral" });
  await expect(overview.getByText("Páginas editáveis")).toHaveCount(0);
  await expect(overview.getByRole("img", { name: /250 Croins/ })).toBeVisible();
  await expect(overview.getByText("Bônus diário", { exact: true })).toBeVisible();
  await overview.getByRole("button", { name: "Hoje", exact: true }).click();
  await expect(overview.getByText("Nenhum palpite registrado neste período.")).toBeVisible();
  await expect(overview.getByText("321", { exact: true })).toBeVisible();
  await expect(overview.getByText("Bônus diário", { exact: true })).toHaveCount(0);
  await overview.getByRole("button", { name: "30 dias", exact: true }).click();
  await expect(overview.getByText("Bônus diário", { exact: true })).toBeVisible();
  await page.goto("/admin/apostas/atraso");
  await page.getByRole("button", { name: "Encerrar apostas", exact: true }).click();
  await page.locator('[aria-label="Confirmar ação"]').getByRole("button", { name: "Confirmar encerramento", exact: true }).click();
  await page.goto("/admin");
  await expect(overview.getByText("Aguardando resultado", { exact: true })).toBeVisible();
  await overview.getByRole("link", { name: /Quantos minutos a live vai atrasar/ }).click();
  await expect(page).toHaveURL("/admin/apostas/atraso");
});
