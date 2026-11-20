import { expect, test, type Page } from "@playwright/test";
import { startPublicApi } from "../public-api-fixture";

let closeApi: (() => Promise<void>) | undefined;
test.beforeAll(async () => { closeApi = await startPublicApi(() => null); });
test.afterAll(async () => { await closeApi?.(); });

async function offerInstall(page: Page, outcome: "accepted" | "dismissed" = "accepted") {
  // A ready navigation confirms React has hydrated and attached listeners.
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("dialog", { name: "Entrar na Croebet", exact: true }).getByRole("button", { name: "Fechar", exact: true }).click();
  return page.evaluate((result) => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => { document.documentElement.dataset.installCalled = "true"; },
      userChoice: Promise.resolve({ outcome: result }),
    });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }, outcome);
}

test("manifest e ícones permitem abrir como app", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: "Croebet", id: "/", start_url: "/", scope: "/", display: "standalone" });
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", "/apple-touch-icon.png");
});

test("instalação exige clique e some após aceitar", async ({ page }) => {
  await page.goto("/");
  expect(await offerInstall(page)).toBe(true);
  const banner = page.getByRole("complementary", { name: "App do Croebet" });
  await expect(banner).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-install-called");
  await banner.getByRole("button", { name: "Instalar app" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-install-called", "true");
  await expect(banner).not.toBeVisible();
});

test("dispensar o aviso evita repetição ao recarregar", async ({ page }) => {
  await page.goto("/");
  await offerInstall(page);
  await page.getByRole("button", { name: "Fechar aviso do app" }).click();
  await page.reload();
  await offerInstall(page);
  await expect(page.getByRole("complementary", { name: "App do Croebet" })).not.toBeVisible();
});

test("Safari iOS recebe instruções para a tela inicial", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Safari iOS");
  await page.goto("/");
  const banner = page.getByRole("complementary", { name: "App do Croebet" });
  await expect(banner).toContainText("Adicionar à Tela de Início");
  await expect(banner.getByRole("button", { name: "Instalar app" })).toHaveCount(0);
});

test("o app instalado não exibe o aviso", async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, "standalone", { value: true }); });
  await page.goto("/");
  await offerInstall(page);
  await expect(page.getByRole("complementary", { name: "App do Croebet" })).not.toBeVisible();
});
