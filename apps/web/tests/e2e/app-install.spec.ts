import { expect, test, type Page } from "@playwright/test";
import { startPublicApi } from "../public-api-fixture";

let closeApi: (() => Promise<void>) | undefined;
test.beforeAll(async () => {
  closeApi = await startPublicApi(request => request.headers.cookie?.includes("install-test") ? {
    id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho",
    role: "user", avatarUrl: null, usernameChangeAvailableAt: null,
  } : null);
});
test.afterAll(async () => { await closeApi?.(); });

async function offerInstall(page: Page, outcome: "accepted" | "dismissed" = "accepted") {
  // A ready navigation confirms React has hydrated and attached listeners.
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("dialog", { name: "Entrar na Croebet", exact: true }).getByRole("button", { name: "Fechar", exact: true }).click();
  return dispatchInstall(page, outcome);
}

async function dispatchInstall(page: Page, outcome: "accepted" | "dismissed" = "accepted") {
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

test("instalação exige clique e some após aceitar", async ({ page, isMobile }) => {
  await page.goto("/");
  expect(await offerInstall(page)).toBe(true);
  if (isMobile) await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  const banner = page.getByRole("complementary", { name: "App do Croebet" });
  await expect(banner).toBeVisible();
  if (isMobile) {
    await expect(page.getByRole("dialog", { name: "Menu da Croebet" }).getByRole("complementary", { name: "App do Croebet" })).toBeVisible();
  } else {
    const sidebar = page.getByRole("complementary", { name: "Menu lateral" });
    await expect(sidebar.getByRole("complementary", { name: "App do Croebet" })).toBeVisible();
    const bannerBox = await banner.boundingBox();
    const signupBox = await sidebar.getByRole("button", { name: "Criar conta" }).boundingBox();
    expect(bannerBox!.y + bannerBox!.height).toBeLessThan(signupBox!.y);
    await page.getByRole("button", { name: "Ocultar menu lateral", exact: true }).click();
    await expect(banner).not.toBeVisible();
    await page.getByRole("button", { name: "Mostrar menu lateral", exact: true }).click();
    await expect(banner).toBeVisible();
  }
  await expect(page.locator("html")).not.toHaveAttribute("data-install-called");
  await banner.getByRole("button", { name: "Instalar app" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-install-called", "true");
  await expect(banner).not.toBeVisible();
});

test("dispensar o aviso evita repetição ao recarregar", async ({ page, isMobile }) => {
  await page.goto("/");
  await offerInstall(page);
  if (isMobile) await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page.getByRole("button", { name: "Fechar aviso do app" }).click();
  await page.reload();
  await offerInstall(page);
  if (isMobile) await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "App do Croebet" })).not.toBeVisible();
});

test("Safari iOS recebe instruções para a tela inicial", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Safari iOS");
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
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

test("banner fica acima dos Croins no sidebar da conta", async ({ page, context, isMobile }) => {
  test.skip(isMobile, "Saldo no sidebar de desktop");
  await context.addCookies([{ name: "croebet-session", value: "install-test", url: "http://127.0.0.1:3100" }]);
  await page.goto("/");
  await page.getByRole("button", { name: "Ocultar menu lateral", exact: true }).click();
  await page.getByRole("button", { name: "Mostrar menu lateral", exact: true }).click();
  expect(await dispatchInstall(page)).toBe(true);
  const sidebar = page.getByRole("complementary", { name: "Menu lateral" });
  const banner = sidebar.getByRole("complementary", { name: "App do Croebet" });
  const wallet = sidebar.getByRole("link", { name: "Ver carteira" });
  await expect(banner).toBeVisible();
  await expect(wallet).toContainText("Croins");
  const bannerBox = await banner.boundingBox();
  const walletBox = await wallet.boundingBox();
  expect(bannerBox!.y + bannerBox!.height).toBeLessThan(walletBox!.y);
});
