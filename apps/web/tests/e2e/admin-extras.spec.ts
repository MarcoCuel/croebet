import { expect, test } from "@playwright/test";
import type { BonusWindowSettings } from "@croebet/shared";
import { startPublicApi } from "../public-api-fixture";

const admin = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Marco", displayName: "Marco", role: "admin", avatarUrl: null, usernameChangeAvailableAt: null };
const initial: BonusWindowSettings = { enabled: false, windows: [{ start: "18:00", end: "19:00" }], version: 0 };
let settings = initial;
let patches: BonusWindowSettings[] = [];
let closeApi: (() => Promise<void>) | undefined;

test.beforeAll(async () => {
  closeApi = await startPublicApi(() => admin, async (request, response) => {
    const path = new URL(request.url ?? "/", "http://fixture").pathname;
    if (path !== "/api/v1/admin/bonus-windows") return false;
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(settings));
    return true;
  });
});
test.afterAll(async () => { await closeApi?.(); });
test.beforeEach(async ({ context, page }) => {
  settings = initial; patches = [];
  await context.addCookies([{ name: "croebet-session", value: "extras-test", url: "http://127.0.0.1:3100" }]);
  await page.route("**/api/v1/auth/csrf", route => route.fulfill({ json: { token: "fixture" } }));
  await page.route("**/api/v1/admin/bonus-windows", async route => {
    if (route.request().method() !== "PATCH") return route.fulfill({ json: settings });
    const body = route.request().postDataJSON() as BonusWindowSettings;
    patches.push(body);
    settings = { ...body, version: body.version + 1 };
    return route.fulfill({ json: settings });
  });
});

test("aba Extras liga o horário bugado e salva as janelas", async ({ page }) => {
  await page.goto("/admin/extras");
  const panel = page.getByRole("region", { name: "Extras" });
  await expect(panel.getByRole("heading", { name: "Horário bugado" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Horário bugado" })).not.toBeChecked();
  const save = panel.getByRole("button", { name: "Salvar alterações" });
  await expect(save).toBeDisabled();
  await page.getByRole("switch", { name: "Horário bugado" }).check();
  await expect(panel.getByText("Ligado", { exact: true })).toBeVisible();
  await save.click();
  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0]).toEqual({ enabled: true, windows: [{ start: "18:00", end: "19:00" }], version: 0 });
  await expect(page.getByText("Horário bugado salvo.")).toBeVisible();
  await expect(save).toBeDisabled();
});

test("janelas sobrepostas são recusadas antes de salvar", async ({ page }) => {
  await page.goto("/admin/extras");
  const panel = page.getByRole("region", { name: "Extras" });
  await page.getByRole("switch", { name: "Horário bugado" }).check();
  await panel.getByRole("button", { name: "Adicionar janela" }).click();
  await expect(panel.getByLabel("Início")).toHaveCount(2);
  await panel.getByLabel("Início").nth(1).fill("18:30");
  await panel.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("As janelas não podem se sobrepor.")).toBeVisible();
  expect(patches).toEqual([]);
});
