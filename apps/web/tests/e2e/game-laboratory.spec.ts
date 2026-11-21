import { expect, test } from "@playwright/test";
import { startPublicApi } from "../public-api-fixture";

let role: "admin" | "user" | null = "admin";
let closeApi: (() => Promise<void>) | undefined;
test.beforeAll(async () => { closeApi = await startPublicApi(() => role ? { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Tonho", displayName: "Tonho", role } : null); });
test.afterAll(async () => { await closeApi?.(); });
test.beforeEach(async ({context}) => {
  role = "admin";
  await context.addCookies([{name:"croebet-session",value:"laboratory-fixture",url:"http://127.0.0.1:3100"}]);
});

test("configura mesa, navega por mão grande, compra, descarta e restaura preferências", async ({ page }) => {
  await page.goto("/admin/jogos/laboratorio");
  await expect(page.getByRole("heading", { name: "Laboratório de jogos" })).toBeVisible();
  await expect(page.getByTestId("laboratory-scene").locator("canvas")).toBeVisible();
  await page.getByRole("button", { name: "50 cartas", exact: true }).click();
  await expect(page.getByLabel("Cartas na mão", { exact: true })).toHaveValue("50");
  const handWindow = page.getByTestId("hand-window");
  const initialWindow = await handWindow.textContent();
  await page.getByRole("button", { name: "Próximas", exact: true }).click();
  await expect(handWindow).toHaveText(/^\d+–\d+ de 50$/);
  await expect(handWindow).not.toHaveText(initialWindow!);
  await expect(page.getByRole("button", { name: "Anteriores", exact: true })).toBeEnabled();
  await page.getByLabel("Jogadores", { exact: true }).fill("6");
  await page.getByLabel("Observar jogador", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Comprar carta", exact: true }).click();
  await expect(page.getByLabel("Cartas na mão", { exact: true })).toHaveValue("51");
  await page.getByRole("button", { name: "Descartar selecionada", exact: true }).click();
  await expect(page.getByLabel("Cartas na mão", { exact: true })).toHaveValue("50");
  await page.getByRole("button", { name: "Salvar configuração", exact: true }).click();
  await page.getByRole("button", { name: "Reiniciar", exact: true }).click();
  await expect(page.getByLabel("Cartas na mão", { exact: true })).toHaveValue("7");
  await page.getByRole("button", { name: "Restaurar configuração", exact: true }).click();
  await expect(page.getByLabel("Jogadores", { exact: true })).toHaveValue("6");
  await expect(page.getByLabel("Observar jogador", { exact: true })).toHaveValue("3");
  await expect(page.getByLabel("Cartas na mão", { exact: true })).toHaveValue("50");
  await page.getByLabel("Cartas na mão", { exact: true }).fill("0");
  await expect(page.getByRole("button", { name: "Descartar selecionada", exact: true })).toBeDisabled();
});

test("visitantes e contas comuns não acessam o laboratório", async ({ page }) => {
  for (const next of ["user", null] as const) {
    role = next;
    await page.goto("/admin/jogos/laboratorio");
    await expect(page.getByRole("heading", { name: "Laboratório de jogos" })).toHaveCount(0);
    await expect(page.locator("canvas")).toHaveCount(0);
  }
});
