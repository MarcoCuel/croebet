import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("croebet:demo-username", "AdminTeste"),
  );
  await page.goto("/admin");
});

test("admin edita jogos e bloqueia acesso direto ao pausar", async ({
  page,
}) => {
  const nav = page.getByRole("navigation", { name: "Seções do admin" });
  await nav.getByRole("link", { name: "Jogos", exact: true }).click();
  await page.getByRole("link", { name: "Editar Flip7", exact: true }).click();
  await expect(page).toHaveURL("/admin/jogos/flip7");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Categoria", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Descrição", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Nome do jogo")).toHaveValue("Flip7");
  await page.getByLabel("Nome do jogo").fill("Flip7 da casa");
  await page.getByRole("button", { name: "Salvar jogo" }).click();
  await expect(page).toHaveURL("/admin/jogos");
  await page.reload();
  await nav.getByRole("link", { name: "Jogos", exact: true }).click();
  const card = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("heading", { name: "Flip7 da casa" }) });
  await expect(
    card.getByRole("img", { name: "Capa de Flip7 da casa" }),
  ).toBeVisible();
  await expect(card.getByText("Ativo", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Pausar" }).click();
  await expect(card.getByText("Inativo", { exact: true })).toBeVisible();
  await page.goto("/jogos");
  await expect(page.getByRole("link", { name: "Flip7 da casa" })).toHaveCount(
    0,
  );
  await page.goto("/jogos/flip7");
  await expect(
    page.getByRole("heading", { name: "Jogo indisponível" }),
  ).toBeVisible();
});

test("admin cria, edita e exclui apostas e publica o Sobre local", async ({
  page,
}) => {
  const nav = page.getByRole("navigation", { name: "Seções do admin" });
  await nav.getByRole("link", { name: "Apostas", exact: true }).click();
  await page.getByRole("link", { name: "Nova aposta", exact: true }).click();
  await page.getByLabel("Pergunta").fill("Vai ter jogo hoje?");
  await expect(page.getByLabel("Categoria", { exact: true })).toHaveCount(0);
  await page
    .getByLabel("Critério do palpite")
    .fill("Vale o primeiro jogo da transmissão.");
  await page.getByRole("button", { name: "Salvar aposta" }).click();
  await page
    .getByRole("button", { name: "Publicar aposta", exact: true })
    .click();
  await page.goto("/apostas");
  await expect(
    page.getByRole("heading", { name: "Vai ter jogo hoje?" }),
  ).toBeVisible();
  await page.goto("/admin/apostas");
  await page
    .getByRole("link", { name: "Gerenciar Vai ter jogo hoje?" })
    .click();
  await page.getByLabel("Pergunta").fill("Vai ter jogo amanhã?");
  await page.getByRole("button", { name: "Salvar aposta" }).click();
  await page
    .getByRole("button", { name: "Excluir aposta", exact: true })
    .click();
  await page
    .locator('[aria-label="Confirmar ação"]')
    .getByRole("button", { name: "Excluir aposta", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/apostas");
  await nav.getByRole("link", { name: "Sobre", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Conteúdo da página Sobre" })
    .fill("A casa está aberta.");
  await page
    .getByRole("group", { name: "Formatação do texto" })
    .getByRole("button", { name: "Título", exact: true })
    .click();
  await page.getByRole("button", { name: "Salvar Sobre" }).click();
  await page.goto("/sobre");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A casa está aberta.",
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "A casa está aberta.",
  );
  await page.goto("/apostas");
  await expect(
    page.getByRole("heading", { name: "Vai ter jogo amanhã?" }),
  ).toHaveCount(0);
});

test("recarga fica no admin, valida conta e persiste movimentação", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Conta de AdminTeste" })
    .last()
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Saldo", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Seções do admin" })
    .getByRole("link", { name: "Saldo", exact: true })
    .click();
  await page.getByLabel("Nome de usuário").fill("Inexistente");
  await page.getByLabel("Adicionar Croins de teste").fill("100");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(
    page.getByText("Conta não encontrada neste navegador."),
  ).toBeVisible();
  await page.getByLabel("Nome de usuário").fill("AdminTeste");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.goto("/historico");
  await expect(
    page.getByText("Croins de teste", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem("croebet:demo-wallet:adminteste") ?? "{}",
          ).balance,
      ),
    )
    .toBe(1167);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("editor visual preserva negrito e listas após salvar e reabrir", async ({
  page,
}) => {
  const nav = page.getByRole("navigation", { name: "Seções do admin" });
  await nav.getByRole("link", { name: "Sobre", exact: true }).click();
  const editor = page.getByRole("textbox", {
    name: "Conteúdo da página Sobre",
  });
  await expect(editor).toContainText("Seu azar.");
  await editor.fill("Contribuições para a casa");
  await editor.press("ControlOrMeta+a");
  await page.getByRole("button", { name: "Negrito", exact: true }).click();
  await page
    .getByRole("button", { name: "Lista com marcadores", exact: true })
    .click();
  await page.getByRole("button", { name: "Salvar Sobre" }).click();
  await page.goto("/sobre");
  await expect(page.getByRole("main").locator("li strong")).toHaveText(
    "Contribuições para a casa",
  );
  await page.goto("/admin");
  await nav.getByRole("link", { name: "Sobre", exact: true }).click();
  await expect(editor.locator("li strong")).toHaveText(
    "Contribuições para a casa",
  );
  await editor.fill("");
  await page.getByRole("button", { name: "Salvar Sobre" }).click();
  await expect(
    page.getByText("Escreva o conteúdo da página antes de salvar."),
  ).toBeVisible();
});
