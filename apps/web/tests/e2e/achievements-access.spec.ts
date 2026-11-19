import { expect, test } from "@playwright/test";

test("rankings e conquistas ficam indisponíveis até uma próxima versão", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  const navigation = page.getByRole("navigation", { name: "Navegação principal" }).filter({ visible: true });
  for (const label of ["Rankings", "Conquistas"]) {
    const item = navigation.locator('[aria-disabled="true"]').filter({ hasText: label });
    await expect(item).toBeVisible();
    await expect(item.getByText("Em breve", { exact: true })).toBeVisible();
  }
  for (const route of ["/rankings", "/conquistas"]) {
    await expect(page.locator(`a[href="${route}"]`)).toHaveCount(0);
    await page.goto(route);
    await expect(page).toHaveURL("/");
  }
});
