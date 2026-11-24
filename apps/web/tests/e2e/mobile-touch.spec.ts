import { expect, test } from "@playwright/test";
import { startPublicApi } from "../public-api-fixture";

let closeApi: (() => Promise<void>) | undefined;
test.beforeAll(async () => { closeApi = await startPublicApi(() => null); });
test.afterAll(async () => { await closeApi?.(); });

test("toques continuam funcionando após fechar menu e modal no celular", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Interação por toque no celular");
  await page.goto("/");
  const viewport = page.locator('meta[name="viewport"]');
  await expect(viewport).toHaveCount(1);
  await expect(viewport).toHaveAttribute("content", /maximum-scale=1/);
  await expect(viewport).toHaveAttribute("content", /user-scalable=no/);
  await expect(page.locator("html")).toHaveCSS("touch-action", "pan-x pan-y");

  await page.getByRole("button", { name: "Abrir menu", exact: true }).tap();
  const menu = page.getByRole("dialog", { name: "Menu da Croebet", exact: true });
  await expect(menu).toBeVisible();
  await menu.getByRole("button", { name: "Fechar", exact: true }).tap();
  await expect(menu).not.toBeVisible();

  await page.getByRole("button", { name: "Entrar", exact: true }).tap();
  const login = page.getByRole("dialog", { name: "Entrar na Croebet", exact: true });
  await expect(login).toBeVisible();
  await login.getByLabel("Nome de usuário").tap();
  await expect(login.getByLabel("Nome de usuário")).toBeFocused();
  await login.getByRole("button", { name: "Fechar", exact: true }).tap();
  await expect(login).not.toBeVisible();

  await page.getByRole("region", { name: "Destaques da Croebet", exact: true }).getByRole("button", { name: "Criar conta", exact: true }).tap();
  await expect(page.getByRole("dialog", { name: "Criar conta", exact: true })).toBeVisible();
});
