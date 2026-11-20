import { expect, test } from "@playwright/test";
import { startPublicApi } from "../public-api-fixture";

const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho", role: "user" };
let closeApi: (() => Promise<void>) | undefined;
test.beforeAll(async () => { closeApi = await startPublicApi(() => user); });
test.afterAll(async () => { await closeApi?.(); });

async function openSettings(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.locator("header").getByRole("button", { name: "Conta de Tonho", exact: true }).click();
  await page.getByRole("menuitem", { name: "Configurações", exact: true }).click();
}

test("histórico aparece no modal com paginação, erro e lista vazia", async ({ page }) => {
  let failing = true;
  await page.route("**/api/v1/me/history?*", route => {
    if (failing) return route.fulfill({ status: 503 });
    const offset = new URL(route.request().url()).searchParams.get("offset");
    return route.fulfill({ json: offset === "0" ? { items: [
      { id: "bonus", kind: "transaction", description: "Bônus diário", createdAt: "2026-11-20T12:00:00Z", amount: 10 },
      { id: "game", kind: "game", description: "Flip 7 · Partida concluída", createdAt: "2026-11-19T12:00:00Z", amount: null },
    ], hasMore: true } : { items: [
      { id: "coupon", kind: "transaction", description: "Cupom resgatado", createdAt: "2026-11-18T12:00:00Z", amount: 20 },
    ], hasMore: false } });
  });
  await openSettings(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Carteira", exact: true })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Não foi possível carregar o histórico.");
  failing = false;
  await dialog.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(dialog.getByText("Bônus diário", { exact: true })).toBeVisible();
  await expect(dialog.getByText("+10 Croins")).toBeVisible();
  await expect(dialog.getByText("Flip 7 · Partida concluída")).toBeVisible();
  await dialog.getByRole("button", { name: "Carregar mais" }).click();
  await expect(dialog.getByText("Cupom resgatado")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Carregar mais" })).toHaveCount(0);
  await page.route("**/api/v1/me/history?*", route => route.fulfill({ json: { items: [], hasMore: false } }));
  await dialog.getByRole("button", { name: "Geral", exact: true }).click();
  await dialog.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(dialog.getByText("Nenhuma atividade registrada ainda.")).toBeVisible();
});

test("troca de senha valida confirmação, mostra erro da API e limpa campos ao reabrir", async ({ page }) => {
  await page.route("**/api/v1/auth/csrf", route => route.fulfill({ json: { token: "test-csrf" } }));
  let requests = 0;
  await page.route("**/api/v1/me/password", route => {
    requests++;
    expect(route.request().method()).toBe("PATCH");
    expect(route.request().postDataJSON()).toEqual({ currentPassword: "senha atual", newPassword: "nova senha segura" });
    return requests === 1 ? route.fulfill({ status: 401, json: { error: { message: "Senha atual incorreta." } } }) : route.fulfill({ status: 204 });
  });
  await openSettings(page);
  await page.getByRole("button", { name: "Conta", exact: true }).click();
  await page.getByRole("button", { name: "Editar senha", exact: true }).click();
  const dialog = page.getByRole("dialog").last();
  await dialog.getByLabel("Senha atual", { exact: true }).fill("senha atual");
  await dialog.getByLabel("Nova senha", { exact: true }).fill("nova senha segura");
  await dialog.getByLabel("Confirmar nova senha", { exact: true }).fill("outra senha");
  await dialog.getByRole("button", { name: "Salvar senha" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("As senhas não coincidem.");
  expect(requests).toBe(0);
  await dialog.getByLabel("Confirmar nova senha", { exact: true }).fill("nova senha segura");
  await dialog.getByRole("button", { name: "Salvar senha" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Senha atual incorreta.");
  await dialog.getByRole("button", { name: "Salvar senha" }).click();
  await expect(page.getByText("Senha atualizada. As outras sessões foram encerradas.")).toBeVisible();
  await page.getByRole("button", { name: "Editar senha", exact: true }).click();
  await expect(page.getByLabel("Senha atual", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Nova senha", { exact: true })).toHaveValue("");
});
