import { startPublicApi } from "../public-api-fixture";
import { expect, test } from "@playwright/test";

let closeApi: (() => Promise<void>) | undefined;
test.beforeAll(async () => { closeApi = await startPublicApi(() => null); });
test.afterAll(async () => { await closeApi?.(); });

test("início apresenta jogos e apostas redirecionam para o início", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Jogos", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apostas", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver apostas", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Apostas abertas" })).toHaveCount(0);

  await page.goto("/apostas");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Jogos", exact: true })).toBeVisible();
});
