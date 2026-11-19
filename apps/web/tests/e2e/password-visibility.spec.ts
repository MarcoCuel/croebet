import { expect, test } from "@playwright/test";

test("login e cadastro permitem mostrar e ocultar a senha", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const dialog = page.getByRole("dialog");

  for (const registering of [false, true]) {
    if (registering) {
      await dialog.getByRole("button", { name: "Cadastre-se", exact: true }).click();
    }
    const password = dialog.getByLabel("Senha", { exact: true });
    await expect(password).toHaveAttribute("type", "password");
    await password.fill("minha-senha-de-teste");
    const show = dialog.getByRole("button", { name: "Mostrar senha", exact: true });
    await show.focus();
    await page.keyboard.press("Enter");
    await expect(password).toHaveAttribute("type", "text");
    await expect(password).toHaveValue("minha-senha-de-teste");
    await dialog.getByRole("button", { name: "Ocultar senha", exact: true }).click();
    await expect(password).toHaveAttribute("type", "password");
    await expect(password).toHaveValue("minha-senha-de-teste");
  }

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(dialog.getByLabel("Senha", { exact: true })).toHaveAttribute("type", "password");
});
