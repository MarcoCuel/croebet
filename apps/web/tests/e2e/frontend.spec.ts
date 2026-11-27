import { Server } from "socket.io";
import { startPublicApi } from "../public-api-fixture";
import { expect, test, type Page } from "@playwright/test";

let closeApi: (() => Promise<void>) | undefined;
let sockets: Server;
let onlineCount = 8;
let onlineCountDelay = 0;
test.beforeAll(async () => {
  closeApi = await startPublicApi(() => account, undefined, server => {
    sockets = new Server(server, { path: "/api/v1/realtime", addTrailingSlash: false, transports: ["websocket"] });
    sockets.on("connection", socket => {
      socket.emit("personal-matches", { items: [] });
      socket.emit("invitations", { items: [] });
      const sendOnlineCount = () => socket.emit("online-count", onlineCount);
      if (onlineCountDelay) setTimeout(sendOnlineCount, onlineCountDelay);
      else sendOnlineCount();
      socket.on("request", (_value: unknown, ack: (reply: unknown) => void) => {
        ack({ ok: true, data: { items: [], onlineCount } });
      });
    });
    return () => { sockets.disconnectSockets(true); sockets.engine.close(); };
  });
});
test.afterAll(async () => { await closeApi?.(); });

let account: { id: string; username: string; displayName: string; role: string } | null = null;
test.beforeEach(async ({ page }) => {
  account = null;
  onlineCount = 8;
  onlineCountDelay = 0;
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

test("partida remove rodapé e mantém conteúdo extenso dentro da tela", async ({ page }) => {
  await page.goto("/jogos/flip7");
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await page.evaluate(() => window.history.pushState(null, "", "/jogos/flip7?partida=ABCDEF123456"));
  await expect(page.getByRole("contentinfo")).toHaveCount(0);
  const content = page.locator("[data-match-content]");
  await expect(content).toBeVisible();
  // Simulate a long table/history without depending on a game engine or WebGL.
  await content.evaluate(element => {
    const section = document.createElement("div");
    section.style.minHeight = "200vh";
    section.dataset.testOverflow = "";
    element.append(section);
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
  await content.evaluate(element => { element.scrollTop = 100; });
  await expect.poll(() => content.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.goBack();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(content).toHaveCount(0);
});

test("sidebar oculta apenas na partida e reaparece no lobby", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Sidebar fixa é exclusiva do desktop");
  const sidebar = page.locator("#lobby-sidebar");
  await page.goto("/jogos");
  await expect(sidebar).toBeVisible();
  await page.getByRole("link", { name: /Flip da comunidade/ }).first().click();
  await expect(page).toHaveURL(/\/jogos\/flip7/);
  await expect(sidebar).toBeVisible();
  // Entering a match also updates the query through the native history API.
  await page.evaluate(() => window.history.pushState(null, "", "/jogos/flip7?partida=ABCDEF123456&teste=1"));
  await expect(sidebar).toBeHidden();
  await page.getByRole("button", { name: "Mostrar menu lateral", exact: true }).click();
  await expect(sidebar).toBeVisible();
  await page.getByRole("button", { name: "Ocultar menu lateral", exact: true }).click();
  await expect(sidebar).toBeHidden();
  await page.getByRole("link", { name: "Voltar para Flip da comunidade", exact: true }).click();
  await expect(page).toHaveURL(/\/jogos\/flip7\?teste=1$/);
  await expect(sidebar).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/partida=ABCDEF123456/);
  await expect(sidebar).toBeHidden();
  await page.reload();
  await expect(sidebar).toBeHidden();
  await page.goForward();
  await expect(page).toHaveURL(/\/jogos\/flip7\?teste=1$/);
  await expect(sidebar).toBeVisible();
});

test("Topbar mostra usuários online somente na Home e no desktop", async ({ page }, testInfo) => {
  await page.goto("/");
  const counter = page.getByRole("status", { name: "Usuários online" });
  if (testInfo.project.name !== "desktop") {
    await expect(counter).toBeHidden();
    await expect.poll(() => sockets.sockets.sockets.size).toBe(0);
    return;
  }
  await expect(counter).toBeVisible();
  await expect(counter).toHaveText("8 online");
  await expect(counter.locator("[aria-hidden='true']")).toHaveClass(/bg-tertiary/);
  await expect.poll(() => sockets.sockets.sockets.size).toBe(1);
  onlineCount = 9;
  sockets.emit("online-count", onlineCount);
  await expect(counter).toHaveText("9 online");
  await page.getByRole("link", { name: "Jogos", exact: true }).first().click();
  await expect(counter).toHaveCount(0);
  await expect.poll(() => sockets.sockets.sockets.size).toBe(0);
  await page.getByRole("link", { name: "Croebet, início", exact: true }).click();
  await expect(counter).toHaveText("9 online");
});

test("Topbar mantém notificações na Home enquanto a contagem de online carrega", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Contador é exclusivo do desktop");
  onlineCountDelay = 2500;
  await page.goto("/");
  const counter = page.getByRole("status", { name: "Usuários online" });
  const notifications = page.getByRole("button", { name: "Notificações", exact: true });
  await expect(counter.locator("[data-slot='skeleton']")).toBeVisible();
  await expect(counter).not.toHaveText(/online/);
  await expect(notifications).toBeVisible();
  await expect(counter).toHaveText("8 online", { timeout: 10000 });
  await expect(notifications).toBeVisible();
});

test("Topbar acompanha a contagem quando a conexão autenticada já está aberta", async ({ page }, testInfo) => {
  await page.goto("/jogos");
  await signIn(page);
  const counter = page.getByRole("status", { name: "Usuários online" });
  await expect.poll(() => sockets.sockets.sockets.size).toBe(1);
  const connectionId = [...sockets.sockets.sockets.keys()][0];

  onlineCount = 10;
  sockets.emit("online-count", onlineCount);
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
    await page.getByRole("dialog").getByRole("link", { name: "Início", exact: true }).click();
    await page.setViewportSize({ width: 1280, height: 720 });
  } else {
    await page.getByRole("link", { name: "Croebet, início", exact: true }).click();
  }
  await expect(counter).toBeVisible();
  await expect(counter).toHaveText("10 online");

  await page.getByRole("link", { name: "Jogos", exact: true }).first().click();
  await expect(counter).toHaveCount(0);
  expect([...sockets.sockets.sockets.keys()]).toEqual([connectionId]);
  onlineCount = 11;
  sockets.emit("online-count", onlineCount);
  await page.getByRole("link", { name: "Croebet, início", exact: true }).click();
  await expect(counter).toHaveText("11 online");
  expect([...sockets.sockets.sockets.keys()]).toEqual([connectionId]);
});

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

test("bônus diário mantém o Croin 3D decorativo fora do conteúdo e do clique", async ({ page }) => {
  await page.goto("/");
  const highlights = page.getByRole("region", { name: "Destaques da Croebet", exact: true });
  const croin = highlights.getByTestId("croin-banner");
  await expect(croin).toHaveAttribute("aria-hidden", "true");
  await expect(croin.locator("canvas")).toBeVisible({ timeout: 15000 });
  await highlights.getByRole("button", { name: "Resgatar", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading")).toHaveText("Entrar na Croebet");
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
  await chooseTheme("Escuro (Contraste)");
  await expect(root).toHaveAttribute("data-theme", "dark-contrast");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "dark-contrast");
  await expect(root).toHaveAttribute("data-theme-preference", "dark-contrast");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await openTheme();
  await expect(page.getByRole("menuitemradio", { name: "Escuro (Contraste)", exact: true })).toHaveAttribute("aria-checked", "true");
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
  await dialog.getByRole("button", { name: "Escuro (Contraste)", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark-contrast");
  await expect(dialog.getByRole("button", { name: "Escuro (Contraste)", exact: true })).toHaveAttribute("aria-pressed", "true");
  await dialog.getByRole("button", { name: "Claro", exact: true }).click();
  await expect(nav.getByRole("button", {name:"Carteira",exact:true})).toHaveCount(0);
  await nav.getByRole("button", { name: "Notificações", exact: true }).click();
  await expect(dialog.getByRole("region", { name: "Notificações", exact: true })).toContainText("Push");
  await nav.getByRole("button", {name:"Geral",exact:true}).click();
  await expect(dialog.getByRole("region", {name:"Geral",exact:true})).toContainText("Preferencias");
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
