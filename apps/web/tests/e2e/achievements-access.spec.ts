import { startPublicApi } from "../public-api-fixture";
import { expect, test } from "@playwright/test";

let closeApi: (() => Promise<void>) | undefined;
test.beforeAll(async () => { closeApi = await startPublicApi(() => null); });
test.afterAll(async () => { await closeApi?.(); });

test("conquistas permanecem indisponíveis e rankings têm acesso público", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  const navigation = page.getByRole("navigation", { name: "Navegação principal" }).filter({ visible: true });
  for (const label of ["Conquistas"]) {
    const item = navigation.locator('[aria-disabled="true"]').filter({ hasText: label });
    await expect(item).toBeVisible();
    await expect(item.getByText("Em breve", { exact: true })).toBeVisible();
  }
  await expect(navigation.getByRole("link", { name: "Rankings", exact: true })).toBeVisible();
  for (const route of ["/conquistas"]) {
    await expect(page.locator(`a[href="${route}"]`)).toHaveCount(0);
    await page.goto(route);
    await expect(page).toHaveURL("/");
  }
});
