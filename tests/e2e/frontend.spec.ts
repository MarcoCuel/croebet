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
    ["/jogos/roleta", "Rola Rola"],
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
  await page.getByRole("menuitem", { name: "Admin", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Seções do admin" })
    .getByRole("link", { name: "Usuários", exact: true })
    .click();
  await page.locator('a[href="/admin/usuarios/minha-conta"]').click();
  await page.getByRole("button", { name: "Ajustar Croins", exact: true }).click();
  await page.getByLabel("Valor em Croins").fill("100");
  await page.getByRole("button", { name: "Adicionar Croins", exact: true }).click();
  await page.goto("/apostas");
  await page.getByRole("button", { name: "Sim", exact: true }).click();
  await page.getByLabel("Valor em Croins").fill("10");
  await page
    .getByRole("button", { name: "Confirmar aposta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Minhas apostas" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Minhas apostas" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sim", exact: true }).click();
  await expect(page.getByLabel("Valor em Croins")).toHaveAttribute(
    "max",
    "1157",
  );
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
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
  test.skip(
    testInfo.project.name === "mobile",
    "O botão ao lado do saldo é exclusivo do topo desktop.",
  );
  await page.goto("/");
  await signIn(page);
  const readWallet = () =>
    page.evaluate(() =>
      localStorage.getItem("croebet:demo-wallet:Arquitetura"),
    );
  await expect.poll(readWallet).not.toBeNull();
  const wallet = await readWallet();
  const trigger = page.getByRole("button", {
    name: "Resgatar cupom",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByLabel("Código do cupom");
  await expect(input).toBeFocused();
  await input.fill("CUPOM-TESTE");
  await dialog
    .getByRole("button", { name: "Resgatar cupom", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  expect(await readWallet()).toBe(wallet);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(input).toHaveValue("");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resgatar bônus diário", exact: true }),
  ).toBeEnabled();
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
    const toggle = page.getByRole("button", { name: "Ocultar menu lateral" });
    await toggle.click();
    await expect(sidebar).not.toBeVisible();
    await expect(page.locator("#page-content")).toHaveCSS(
      "padding-left",
      "0px",
    );
    const showMenu = page.getByRole("button", { name: "Mostrar menu lateral" });
    await expect(showMenu).toHaveAttribute("aria-expanded", "false");
    await expect(showMenu).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(sidebar).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(
      sidebar.getByRole("link", { name: "Sobre", exact: true }),
    ).toBeVisible();
  }
});

test("tema persiste e System acompanha a preferência do sistema", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await signIn(page);
  const root = page.locator("html");
  const openTheme = async () => {
    await page
      .getByRole("button", { name: "Conta de Arquitetura", exact: true })
      .last()
      .click();
    await page.getByRole("menuitem", { name: "Tema", exact: true }).click();
  };
  await openTheme();
  await expect(page.getByRole("menuitemradio")).toHaveCount(3);
  await page.getByRole("menuitemradio", { name: "Light", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "light");
  await openTheme();
  await expect(
    page.getByRole("menuitemradio", { name: "Light", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveAttribute("data-theme", "dark");
  await openTheme();
  await page
    .getByRole("menuitemradio", { name: "System", exact: true })
    .click();
  await expect(root).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(root).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(root).toHaveAttribute("data-theme-preference", "system");
});

test("apostas aceitam sim ou não, opções e minutos sem odds", async ({
  page,
}) => {
  await page.goto("/apostas");
  await signIn(page, "Palpites");
  const history = page.getByRole("region", { name: "Minhas apostas" });
  const confirm = async () => {
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Valor em Croins").fill("10");
    await dialog
      .getByRole("button", { name: "Confirmar aposta", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
  };

  await page.getByRole("button", { name: "Não", exact: true }).click();
  await confirm();
  await expect(history.getByText("Não", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Até 1 hora", exact: true }).click();
  await confirm();
  await expect(history.getByText("Até 1 hora", { exact: true })).toBeVisible();

  const minutes = page.getByLabel("Atraso em minutos");
  await expect(
    page.getByRole("button", { name: "Apostar", exact: true }),
  ).toBeDisabled();
  await minutes.fill("1.5");
  await expect(
    page.getByRole("button", { name: "Apostar", exact: true }),
  ).toBeDisabled();
  for (const value of ["0", "23"]) {
    await minutes.fill(value);
    await page.getByRole("button", { name: "Apostar", exact: true }).click();
    await confirm();
    await expect(
      history.getByText(`${value} minutos`, { exact: true }),
    ).toBeVisible();
  }
  await page.reload();
  await expect(history.getByRole("listitem")).toHaveCount(4);
  await page.getByRole("button", { name: "Sim", exact: true }).click();
  await expect(page.getByLabel("Valor em Croins")).toHaveAttribute(
    "max",
    "1027",
  );
  await page.getByRole("dialog").getByLabel("Valor em Croins").fill("1028");
  await expect(
    page.getByRole("button", { name: "Confirmar aposta", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Sim", exact: true }),
  ).toBeFocused();
});

test("navbar alterna a home e exibe títulos nas internas", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const header = page.locator("header").first();
  if (testInfo.project.name === "desktop") {
    const sections = header.getByRole("navigation", {
      name: "Seções da Croebet",
    });
    const banners = page.getByRole("region", { name: "Destaques da Croebet" });
    await expect(banners).toBeVisible();
    await expect(page.getByLabel("Atraso em minutos")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Apostas em destaque" }),
    ).toHaveCount(0);
    await sections
      .getByRole("button", { name: "Apostas", exact: true })
      .click();
    await expect(page).toHaveURL("/");
    await expect(
      sections.getByRole("button", { name: "Apostas", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Atraso em minutos")).toBeVisible();
    await expect(banners).toBeVisible();
    await expect(banners.getByRole("heading")).toHaveCount(3);
    await expect(page.locator("#bets-title")).toHaveText("Apostas");
    await expect(page.locator("#bets-title")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Minhas apostas" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Jogos", exact: true }),
    ).toHaveCount(0);
    await sections
      .getByRole("button", { name: "Cassino", exact: true })
      .click();
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", { name: "Jogos", exact: true }),
    ).toBeVisible();
    await expect(banners).toBeVisible();
    await expect(page.getByLabel("Atraso em minutos")).toHaveCount(0);
  }
  for (const [path, title] of [
    ["/jogos", "Jogos"],
    ["/apostas", "Apostas"],
    ["/rankings", "Rankings"],
    ["/sobre", "Sobre"],
    ["/jogos/roleta", "Roleta Rola Rola"],
  ]) {
    await page.goto(path);
    await expect(
      header.getByRole("navigation", { name: "Seções da Croebet" }),
    ).toHaveCount(0);
    await expect(header.getByText(title, { exact: true })).toBeVisible();
  }
  await header.getByRole("link", { name: "Voltar para Jogos" }).click();
  await expect(page).toHaveURL("/jogos");
});

test("saldo leva ao histórico e a recarga fica no admin", async ({ page }) => {
  await page.goto("/apostas");
  await signIn(page, "Extrato");
  await page
    .getByRole("link", { name: "Ver histórico de Croins" })
    .last()
    .click();
  await expect(page).toHaveURL("/historico");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Nenhuma movimentação registrada ainda."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Conta de Extrato", exact: true })
    .last()
    .click();
  await page.getByRole("menuitem", { name: "Admin", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Seções do admin" })
    .getByRole("link", { name: "Usuários", exact: true })
    .click();
  await page.locator('a[href="/admin/usuarios/minha-conta"]').click();
  await page.getByRole("button", { name: "Ajustar Croins", exact: true }).click();
  await page.getByLabel("Valor em Croins").fill("100");
  await page.getByRole("button", { name: "Adicionar Croins", exact: true }).click();
  await page.goto("/apostas");
  await page.getByRole("button", { name: "Sim", exact: true }).click();
  await page.getByLabel("Valor em Croins").fill("10");
  await page
    .getByRole("button", { name: "Confirmar aposta", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Conta de Extrato", exact: true })
    .last()
    .click();
  await page.getByRole("menuitem", { name: "Histórico", exact: true }).click();
  const movements = page.getByRole("region", { name: "Movimentações" });
  await expect(movements.getByRole("listitem")).toHaveCount(2);
  await expect(
    movements.getByText("Saldo: 1.157", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Entradas", exact: true }).click();
  await expect(movements.getByRole("listitem")).toHaveCount(1);
  await expect(
    movements.getByText("Croins adicionados pelo admin", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Saídas", exact: true }).click();
  await expect(movements.getByRole("listitem")).toHaveCount(1);
  await expect(movements.getByText(/Aposta ·/)).toBeVisible();
  await page.reload();
  await expect(movements.getByRole("listitem")).toHaveCount(2);
});

test("carteira antiga preserva saldo e começa sem movimentações inventadas", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("croebet:demo-username")) {
      localStorage.setItem("croebet:demo-username", "Legado");
      localStorage.setItem(
        "croebet:demo-wallet:legado",
        JSON.stringify({
          balance: 321,
          lastClaim: "17/11/2026",
          predictions: [],
        }),
      );
    }
  });
  await page.goto("/historico");
  await expect(
    page.getByText("Nenhuma movimentação registrada ainda."),
  ).toBeVisible();
  await expect(
    page.getByRole("main").getByText("321", { exact: false }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("croebet:demo-wallet:legado") ?? "{}")
            .balance,
      ),
    )
    .toBe(321);
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
  await expect(
    nav.getByRole("link", { name: "Geral", exact: true }),
  ).toBeFocused();
  await expect(
    dialog.getByRole("region", { name: "Geral", exact: true }),
  ).toContainText("Preferencias");
  await nav.getByRole("link", { name: "Aparência", exact: true }).click();
  await dialog.getByRole("button", { name: "Claro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    dialog.getByRole("button", { name: "Claro", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await nav.getByRole("link", { name: "Histórico", exact: true }).click();
  await expect(
    dialog.getByText("Nenhuma movimentação registrada ainda."),
  ).toBeVisible();
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await nav.getByRole("link", { name: "Conta", exact: true }).click();
  await expect(dialog.getByLabel("Nome de usuário")).toHaveValue(
    "Preferencias",
  );
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

test("foto de perfil persiste por conta e pode ser removida", async ({
  page,
}) => {
  await page.goto("/");
  await signIn(page, "Avatar");
  const account = page
    .getByRole("button", { name: "Conta de Avatar", exact: true })
    .last();
  const settings = page.getByRole("dialog", {
    name: "Configurações",
    exact: true,
  });
  async function openAccount() {
    await account.click();
    await page
      .getByRole("menuitem", { name: "Configurações", exact: true })
      .click();
    await settings.getByRole("button", { name: "Conta", exact: true }).click();
  }
  await openAccount();
  const picker = settings.getByLabel("Escolher foto de perfil");
  await picker.setInputFiles({
    name: "invalid.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid"),
  });
  await expect(
    page.getByText("Escolha uma imagem JPG, PNG ou WebP."),
  ).toBeVisible();
  await expect(
    settings.getByRole("button", { name: "Adicionar foto", exact: true }),
  ).toBeEnabled();
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
    "base64",
  );
  await picker.setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(
    settings.getByRole("img", { name: "Sua foto de perfil" }),
  ).toBeVisible();
  await expect(account.locator("img")).toHaveAttribute(
    "src",
    /^data:image\/jpeg;base64,/,
  );
  await page.reload();
  await expect(account.locator("img")).toBeVisible();
  await account.click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await signIn(page, "OutroAvatar");
  await expect(
    page
      .getByRole("button", { name: "Conta de OutroAvatar", exact: true })
      .last()
      .locator("img"),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Conta de OutroAvatar", exact: true })
    .last()
    .click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await signIn(page, "Avatar");
  await expect(account.locator("img")).toBeVisible();
  await openAccount();
  await settings
    .getByRole("button", { name: "Remover foto", exact: true })
    .click();
  await expect(account.locator("img")).toHaveCount(0);
  await page.reload();
  await expect(account).toBeVisible();
  await expect(account.locator("img")).toHaveCount(0);
});

test("nome público muda sem alterar o usuário de login, saldo ou permissões", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  const walletBefore = await page.evaluate(() => localStorage.getItem("croebet:demo-wallet:arquitetura"));
  await page.getByRole("button", { name: "Conta de Arquitetura", exact: true }).last().click();
  await page.getByRole("menuitem", { name: "Configurações", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Configurações", exact: true });
  await dialog.getByRole("button", { name: "Conta", exact: true }).click();
  await expect(dialog.getByLabel("Nome de usuário", { exact: true })).toHaveValue("Arquitetura");
  await expect(dialog.getByLabel("Nome de usuário", { exact: true })).toHaveAttribute("readonly", "");
  await dialog.getByLabel("Nome", { exact: true }).fill("Marco Cuel");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByText("Nome atualizado.", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Fechar configurações", exact: true }).click();
  await expect(page.getByRole("button", { name: "Conta de Marco Cuel", exact: true }).last()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Conta de Marco Cuel", exact: true }).last().click();
  await expect(page.getByRole("menuitem", { name: "Admin", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("croebet:demo-username"))).toBe("Arquitetura");
  expect(await page.evaluate(() => localStorage.getItem("croebet:demo-wallet:arquitetura"))).toBe(walletBefore);
  expect(await page.evaluate(() => localStorage.getItem("croebet:demo-wallet:marco cuel"))).toBeNull();
});
