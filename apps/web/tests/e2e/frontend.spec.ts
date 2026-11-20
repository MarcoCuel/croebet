import { startPublicApi } from "../public-api-fixture";
import { expect, test, type Page } from "@playwright/test";

let closeApi: (() => Promise<void>) | undefined;
test.beforeAll(async () => { closeApi = await startPublicApi(() => account); });
test.afterAll(async () => { await closeApi?.(); });

let account: { id: string; username: string; displayName: string; role: string } | null = null;
test.beforeEach(async ({ page }) => {
  account = null;
  await page.route("**/api/v1/**", route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/v1/auth/csrf") return route.fulfill({ json: { token: "fixture" } });
    if (path === "/api/v1/auth/login") {
      const { username } = request.postDataJSON();
      account = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username, displayName: username, role: "user" };
    }
    if (path === "/api/v1/economy") return route.fulfill({ json: { initialBalance: 30, dailyReward: 10, dailyResetTimeZone: "America/Sao_Paulo", suggestedBets: [1,5,10,50], defaultBet: 5 } });
    if (path === "/api/v1/rewards/daily") return route.fulfill({ json: { balance: 30, lastClaimAt: null, nextClaimAt: null, eligible: true, serverNow: new Date().toISOString() } });
    return route.fulfill({ json: { user: account }, headers: path === "/api/v1/auth/login" ? { "set-cookie": "croebet-session=ui-fixture; Path=/; HttpOnly; SameSite=Lax" } : {} });
  });
});
async function signIn(page: Page, username = "Arquitetura") {
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome de usuário").fill(username);
  await dialog.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test("modal de autenticação alterna modo, fecha por Escape e devolve o foco", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Entrar", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Nome de usuário")).toBeFocused();
  await dialog.getByRole("button", { name: "Cadastre-se" }).click();
  await expect(dialog.getByRole("heading")).toHaveText("Criar conta");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page
    .locator('[data-slot="dialog-overlay"]')
    .click({ position: { x: 4, y: 4 } });
  await expect(dialog).not.toBeVisible();
});

test("tema persiste e System acompanha a preferência do sistema", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await signIn(page);
  const root = page.locator("html");
  const chooseTheme = async (name: string) => {
    const option = page.getByRole("menuitemradio", { name, exact: true });
    const box = await option.boundingBox();
    expect(box).not.toBeNull();
    // Follow the pointer corridor of Radix's submenu instead of teleporting
    // past its trigger, which dismisses the submenu before the click.
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 10 });
    await option.click();
  };
  const openTheme = async () => {
    await page
      .getByRole("button", { name: "Conta de Arquitetura", exact: true })
      .last()
      .click();
    await page.getByRole("menuitem", { name: "Tema", exact: true }).click();
  };
  await openTheme();
  await expect(page.getByRole("menuitemradio")).toHaveCount(4);
  await chooseTheme("Light");
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "light");
  await openTheme();
  await expect(
    page.getByRole("menuitemradio", { name: "Light", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await chooseTheme("Dark");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-theme", "dark");
  await openTheme();
  await chooseTheme("Dark contrast");
  await expect(root).toHaveAttribute("data-theme", "dark-contrast");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "dark-contrast");
  await expect(root).toHaveAttribute("data-theme-preference", "dark-contrast");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await openTheme();
  await expect(page.getByRole("menuitemradio", { name: "Dark contrast", exact: true })).toHaveAttribute("aria-checked", "true");
  await chooseTheme("System");
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme-preference", "system");
});

test("configurações alternam seções, aplicam tema e devolvem foco ao fechar", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "Preferencias");
  const account = page
    .getByRole("button", { name: "Conta de Preferencias", exact: true })
    .last();
  const openSettings = async () => {
    await account.click();
    await page
      .getByRole("menuitem", { name: "Configurações", exact: true })
      .click();
  };
  await openSettings();
  const dialog = page.getByRole("dialog", {
    name: "Configurações",
    exact: true,
  });
  const nav = dialog.getByRole("navigation", {
    name: "Seções de configurações",
  });
  await expect(nav.getByRole("button", { name: "Geral", exact: true })).toHaveAttribute("aria-current", "true");
  await expect(
    dialog.getByRole("region", { name: "Geral", exact: true }),
  ).toContainText("Preferencias");
  await nav.getByRole("button", { name: "Aparência", exact: true }).click();
  await dialog.getByRole("button", { name: "Claro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    dialog.getByRole("button", { name: "Claro", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Dark contrast", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark-contrast");
  await expect(dialog.getByRole("button", { name: "Dark contrast", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Claro", exact: true }).click();
  await nav.getByRole("button", { name: "Carteira", exact: true }).click();
  await expect(
    dialog.getByRole("link", { name: "Ver carteira" }),
  ).toBeVisible();
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await nav.getByRole("button", { name: "Conta", exact: true }).click();
  await expect(dialog.getByText("@Preferencias", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(account).toBeFocused();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await openSettings();
  await dialog
    .getByRole("button", { name: "Fechar configurações", exact: true })
    .click();
  await expect(account).toBeFocused();
});
