import { startPublicApi } from "../public-api-fixture";
import { expect, test, type Locator } from "@playwright/test";

let closeApi: (() => Promise<void>) | undefined;
test.beforeAll(async () => { closeApi = await startPublicApi(() => null); });
test.afterAll(async () => { await closeApi?.(); });

test("login e cadastro permitem mostrar e ocultar a senha", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const field = (label: string) => {
    const input = dialog.getByLabel(label, { exact: true });
    const control = (name: "Mostrar senha" | "Ocultar senha"): Locator =>
      input.locator("..").getByRole("button", { name, exact: true });
    return { input, control };
  };

  for (const registering of [false, true]) {
    if (registering) {
      await dialog.getByRole("button", { name: "Cadastre-se", exact: true }).click();
    }
    const password = field("Senha");
    await expect(password.input).toHaveAttribute("type", "password");
    await password.input.fill("minha-senha-de-teste");
    const show = password.control("Mostrar senha");
    await show.focus();
    await page.keyboard.press("Enter");
    await expect(password.input).toHaveAttribute("type", "text");
    await expect(password.input).toHaveValue("minha-senha-de-teste");
    await password.control("Ocultar senha").click();
    await expect(password.input).toHaveAttribute("type", "password");
    await expect(password.input).toHaveValue("minha-senha-de-teste");

    if (!registering) continue;
    const confirmation = field("Confirmar senha");
    await expect(confirmation.input).toHaveAttribute("type", "password");
    await confirmation.input.fill("minha-senha-de-teste");
    await confirmation.control("Mostrar senha").click();
    await expect(confirmation.input).toHaveAttribute("type", "text");
    await expect(confirmation.input).toHaveValue("minha-senha-de-teste");
    await expect(password.input).toHaveAttribute("type", "password");
    await confirmation.control("Ocultar senha").click();
    await expect(confirmation.input).toHaveAttribute("type", "password");
  }

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(dialog.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "password");
});
