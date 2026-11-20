import { startPublicApi } from "../public-api-fixture";
import { expect, test } from "@playwright/test";

let closeApi: (() => Promise<void>) | undefined;
test.beforeAll(async () => { closeApi = await startPublicApi(() => null); });
test.afterAll(async () => { await closeApi?.(); });

test("rankings é público e conquistas ficam ocultas para visitantes", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  const navigation = page.getByRole("navigation", { name: "Navegação principal" }).filter({ visible: true });
  await expect(navigation.getByRole("link", { name: "Rankings", exact: true })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Conquistas", exact: true })).toHaveCount(0);
  await page.goto("/conquistas");
  await expect(page).toHaveURL("/");
});
