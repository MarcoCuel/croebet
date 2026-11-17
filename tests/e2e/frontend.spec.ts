import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, username = "Arquitetura") {
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome de usuário").fill(username);
  await dialog.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await dialog.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

test("rotas mantêm conteúdo, imagens, responsividade e não montam Canvas", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [path, title] of [
    ["/", "Aposte na"],
    ["/jogos", "Jogos"],
    ["/apostas", "Apostas"],
    ["/rankings", "Rankings"],
    ["/sobre", "Sobre o Croebet"],
    ["/jogos/roleta", "Roleta Rola Rola"],
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect
      .poll(() =>
        page
          .locator("img")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
  }
  await page.goto("/jogos/inexistente");
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  expect(errors).toEqual([]);
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

test("sessão preserva carteira, bônus diário e palpites após recarregar", async ({
  page,
}) => {
  await page.goto("/apostas");
  await signIn(page);
  const account = page
    .getByRole("button", { name: "Conta de Arquitetura", exact: true })
    .last();
  await account.click();
  await page.getByRole("menuitem", { name: "Saldo", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading")).toHaveText("Saldo de Croins");
  await dialog.getByLabel("Adicionar Croins de teste").fill("100");
  await dialog.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Vai à votação" }).click();
  await page.getByLabel("Valor em Croins").fill("10");
  await page.getByRole("button", { name: "Registrar palpite" }).click();
  await expect(page.getByText("Saldo disponível: 1.157 Croins")).toBeVisible();
  await expect(page.getByText("Palpites da sessão")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Palpites da sessão")).toBeVisible();
  await page.getByRole("button", { name: "Vai à votação" }).click();
  await expect(page.getByText("Saldo disponível: 1.157 Croins")).toBeVisible();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Resgatar", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("button", { name: "Resgatado hoje", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Resgatado hoje", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Conta de Arquitetura", exact: true })
    .last()
    .click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeVisible();
  await signIn(page);
  await expect(
    page.getByRole("button", { name: "Resgatado hoje", exact: true }),
  ).toBeDisabled();
});

test("resgate de cupom abre modal sem consumir o bônus diário ou alterar o saldo", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "O botão ao lado do saldo é exclusivo do topo desktop.");
  await page.goto("/");
  await signIn(page);
  const readWallet = () => page.evaluate(() => localStorage.getItem("croebet:demo-wallet:Arquitetura"));
  await expect.poll(readWallet).not.toBeNull();
  const wallet = await readWallet();
  const trigger = page.getByRole("button", { name: "Resgatar cupom", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByLabel("Código do cupom");
  await expect(input).toBeFocused();
  await input.fill("CUPOM-TESTE");
  await dialog.getByRole("button", { name: "Resgatar cupom", exact: true }).click();
  await expect(dialog).toBeVisible();
  expect(await readWallet()).toBe(wallet);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(input).toHaveValue("");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Resgatar bônus diário", exact: true })).toBeEnabled();
});

test("navegação lateral se adapta ao dispositivo e responde ao teclado", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("link", { name: "Sobre", exact: true }).click();
    await expect(page).toHaveURL("/sobre");
    await expect(dialog).not.toBeVisible();
    await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Abrir menu", exact: true }),
    ).toBeFocused();
  } else {
    const sidebar = page.getByRole("complementary", { name: "Menu lateral" });
    const initialWidth = await sidebar.evaluate(
      (element) => element.getBoundingClientRect().width,
    );
    await page
      .getByRole("button", { name: "Alternar largura do menu lateral" })
      .click();
    expect(
      await sidebar.evaluate(
        (element) => element.getBoundingClientRect().width,
      ),
    ).toBeLessThan(initialWidth);
    await page
      .getByRole("button", { name: "Alternar largura do menu lateral" })
      .click();
    await expect(
      sidebar.getByRole("link", { name: "Sobre", exact: true }),
    ).toBeVisible();
  }
});

test("tema persiste e System acompanha a preferência do sistema", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await signIn(page);
  const root = page.locator("html");
  const openTheme = async () => {
    await page.getByRole("button", { name: "Conta de Arquitetura", exact: true }).last().click();
    await page.getByRole("menuitem", { name: "Tema", exact: true }).click();
  };
  await openTheme();
  await expect(page.getByRole("menuitemradio")).toHaveCount(3);
  await page.getByRole("menuitemradio", { name: "Light", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "light");
  await openTheme();
  await expect(page.getByRole("menuitemradio", { name: "Light", exact: true })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-theme", "dark");
  await openTheme();
  await page.getByRole("menuitemradio", { name: "System", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme-preference", "system");
});
