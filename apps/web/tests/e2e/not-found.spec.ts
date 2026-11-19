import { expect, test } from "@playwright/test";

test("404 personalizada mantém navegação e caminhos de retorno", async ({ page }) => {
  for (const path of ["/pagina-inexistente", "/jogos/inexistente", "/rota/inexistente/aninhada"]) {
    await page.goto(path);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Página não encontrada", exact: true })).toBeVisible();
    await expect(page).toHaveTitle("Página não encontrada · Croebet");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await main.getByRole("link", { name: "Voltar ao início", exact: true }).click();
    await expect(page).toHaveURL("/");
    await page.goto(path);
    await main.getByRole("link", { name: "Explorar jogos", exact: true }).click();
    await expect(page).toHaveURL("/jogos");
  }
});
