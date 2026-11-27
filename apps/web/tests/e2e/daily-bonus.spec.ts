import { expect, test } from "@playwright/test";
import { fixedMenuPages, type DailyStatus } from "@croebet/shared";
import { startPublicApi } from "../public-api-fixture";

const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho", role: "user", avatarUrl: null, usernameChangeAvailableAt: null };
const initial = (): DailyStatus => ({ balance: 30, eligible: true, lastClaimAt: null, nextClaimAt: null, serverNow: "2026-11-20T12:00:00.000Z", windowActive: false, nextWindowAt: null });
let daily = initial();
let unavailable = false;
let claims = 0;
let closeApi: (() => Promise<void>) | undefined;

test.beforeAll(async () => {
  closeApi = await startPublicApi(request => request.headers.cookie?.includes("bonus-test") ? user : null, async (request, response) => {
    const path = request.url;
    if (path === "/api/v1/navigation") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({
        main: Object.entries(fixedMenuPages).map(([fixed, item], index) => ({ id: `93089d02-0b34-4b78-9d3e-f2679c190b${60 + index}`, ...item, fixed, newTab: false })),
        footer: [{ id: "93089d02-0b34-4b78-9d3e-f2679c190b70", label: "Sobre", href: "/sobre", fixed: null, newTab: false, disabled: false }],
      }));
      return true;
    }
    if (path !== "/api/v1/rewards/daily" && path !== "/api/v1/rewards/daily/claim" && path !== "/api/v1/auth/csrf") return false;
    response.setHeader("content-type", "application/json");
    if (path === "/api/v1/auth/csrf") { response.end(JSON.stringify({ token: "fixture" })); return true; }
    if (unavailable) { response.statusCode = 503; response.end("{}"); return true; }
    if (path === "/api/v1/rewards/daily/claim") {
      claims++;
      daily = daily.windowActive && claims === 1
        ? { ...daily, balance: 40, eligible: true, lastClaimAt: daily.serverNow, nextClaimAt: null }
        : { ...daily, balance: 30 + claims * 10, eligible: false, lastClaimAt: daily.serverNow, nextClaimAt: "2026-11-21T12:00:00.000Z" };
    }
    response.end(JSON.stringify(daily));
    return true;
  });
});
test.afterAll(async () => { await closeApi?.(); });
test.beforeEach(async ({ context }) => {
  daily = initial(); unavailable = false; claims = 0;
  await context.addCookies([{ name: "croebet-session", value: "bonus-test", url: "http://127.0.0.1:3100" }]);
});

test("presente permite resgatar uma vez e desaparece após confirmação", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  const header = isMobile ? page.getByRole("dialog", { name: "Menu da Croebet" }) : page.locator("header");
  const gift = header.getByRole("button", { name: "Resgatar bônus diário", exact: true });
  await expect(gift).toBeVisible();
  await expect(gift).toHaveText("Bônus diário");
  await expect(header.getByRole("button", { name: "Notificações", exact: true })).toBeVisible();
  await gift.click();
  await expect(gift).toHaveCount(0);
  await expect(header.getByRole("link", { name: "Ver carteira" }).filter({ visible: true })).toContainText("40");
  expect(claims).toBe(1);
  await page.reload();
  await expect(gift).toHaveCount(0);
});

test("horário bugado libera o segundo resgate e some depois do limite", async ({ page, isMobile }) => {
  daily = { ...initial(), windowActive: true, nextWindowAt: "2026-11-21T18:00:00.000Z" };
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  const header = isMobile ? page.getByRole("dialog", { name: "Menu da Croebet" }) : page.locator("header");
  const gift = header.getByRole("button", { name: "Resgatar bônus do horário bugado", exact: true });
  await expect(gift).toHaveText("Bônus bugado");
  await gift.click();
  await expect(gift).toBeVisible();
  await expect(header.getByRole("link", { name: "Ver carteira" }).filter({ visible: true })).toContainText("40");
  await gift.click();
  await expect(gift).toHaveCount(0);
  expect(claims).toBe(2);
});

test("presente aparece quando o intervalo acaba sem recarregar", async ({ page, isMobile }) => {
  daily = { ...initial(), eligible: false, lastClaimAt: "2026-11-19T12:00:02.000Z", nextClaimAt: "2026-11-20T12:00:02.000Z" };
  await page.clock.install({ time: new Date(daily.serverNow) });
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  const gift = page.getByRole("button", { name: "Resgatar bônus diário", exact: true }).filter({ visible: true });
  await expect(gift).toHaveCount(0);
  await page.clock.runFor(3000);
  await expect(gift).toBeVisible();
});

test("presente fica oculto sem status confirmado e para visitantes", async ({ page, context, isMobile }) => {
  unavailable = true;
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await expect(page.getByRole("button", { name: "Notificações", exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resgatar bônus diário", exact: true })).toHaveCount(0);
  unavailable = false;
  await context.clearCookies();
  await page.reload();
  await expect(page.locator("header").getByRole("button", { name: "Entrar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resgatar bônus diário", exact: true })).toHaveCount(0);
});

for (const width of [320, 390]) {
  test(`navbar e menu organizam os atalhos em ${width}px`, async ({ page, isMobile }) => {
    test.skip(!isMobile, "Layout do menu mobile");
    await page.setViewportSize({ width, height: 853 });
    await page.goto("/");
    const header = page.locator("header");
    await expect(header.getByRole("link", { name: "Ver carteira" })).toBeHidden();
    await expect(header.getByRole("button", { name: "Notificações", exact: true })).toBeHidden();
    await expect(header.getByRole("button", { name: "Resgatar bônus diário" })).toBeHidden();
    await expect(header.getByRole("button", { name: "Chat geral", exact: true })).toBeVisible();
    await header.getByRole("button", { name: "Abrir menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu da Croebet" });
    const wallet = menu.getByRole("link", { name: "Ver carteira" });
    await expect(wallet).toContainText("30 Croins");
    await expect(menu.getByRole("button", { name: "Resgatar cupom" })).toBeVisible();
    const box = await wallet.boundingBox();
    expect(box!.y).toBeGreaterThan(853 / 2);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    const notifications = menu.getByRole("button", { name: "Notificações", exact: true });
    const close = menu.getByRole("button", { name: "Fechar", exact: true });
    const notificationBox = await notifications.boundingBox();
    const closeBox = await close.boundingBox();
    expect(notificationBox!.x + notificationBox!.width).toBeLessThanOrEqual(closeBox!.x);
    expect(Math.abs(notificationBox!.y - closeBox!.y)).toBeLessThan(8);
    expect(notificationBox!.y).toBeLessThan(100);
    const footerLink = menu.getByRole("navigation", { name: "Navegação do rodapé" }).getByRole("link", { name: "Sobre" });
    await expect(footerLink).toHaveAttribute("href", "/sobre");
    expect((await footerLink.boundingBox())!.y).toBeGreaterThan(box!.y);
    await notifications.click();
    await expect(page.getByRole("menu", { name: "Notificações" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu.getByRole("button", { name: "Notificações", exact: true })).toBeFocused();
    await wallet.click();
    await expect(page).toHaveURL(/\/carteira$/);
    await expect(menu).not.toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}
