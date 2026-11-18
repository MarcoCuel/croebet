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
  await nav.getByRole("link", { name: "Páginas", exact: true }).click();
  await page.getByRole("link", { name: "Editar Sobre", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Conteúdo da página Sobre" })
    .fill("A casa está aberta.");
  await page
    .getByRole("group", { name: "Formatação do texto" })
    .getByRole("button", { name: "Título", exact: true })
    .click();
  await page.getByRole("button", { name: "Salvar página" }).click();
  await expect(page).toHaveURL("/admin/paginas");
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

test("ajuste de Croins fica na própria conta e persiste entradas e retiradas", async ({ page }) => {
  await page.goto("/admin/usuarios");
  await expect(page.getByRole("link", { name: "Ver usuário AdminTeste" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Seções do admin" }).getByRole("link", { name: "Saldo", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Ver usuário AdminTeste" }).click();
  await expect(page.getByText("Nenhuma movimentação registrada ainda.")).toBeVisible();
  const adjust = page.getByRole("button", { name: "Ajustar Croins", exact: true });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await adjust.click();
  await expect(page.getByRole("dialog", { name: "Ajustar Croins" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(adjust).toBeFocused();
  await adjust.click();
  await page.getByLabel("Valor em Croins").fill("100");
  await page.getByRole("button", { name: "Adicionar Croins", exact: true }).click();
  await expect(page.getByText("Croins adicionados pelo admin", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await adjust.click();
  await page.getByRole("button", { name: "Retirar", exact: true }).click();
  await page.getByLabel("Valor em Croins").fill("50");
  await page.getByRole("button", { name: "Retirar Croins", exact: true }).click();
  await expect(page.getByText("Retirada de Croins pelo admin", { exact: true })).toBeVisible();
  await adjust.click();
  await page.getByRole("button", { name: "Retirar", exact: true }).click();
  await page.getByLabel("Valor em Croins").fill("999999");
  await page.getByRole("button", { name: "Retirar Croins", exact: true }).click();
  await expect(page.getByText("Informe um valor inteiro de 1 a 999999 e verifique o saldo disponível.")).toBeVisible();
  await page.reload();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("croebet:demo-wallet:adminteste") ?? "{}").balance)).toBe(1117);
  await page.goto("/historico");
  await expect(page.getByText("Croins adicionados pelo admin", { exact: true })).toBeVisible();
  await expect(page.getByText("Retirada de Croins pelo admin", { exact: true })).toBeVisible();
  await page.goto("/admin/usuarios/luna");
  await expect(page.getByRole("heading", { name: "Ajustar Croins" })).toHaveCount(0);
  await page.goto("/admin/saldo");
  await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
});

test("editor visual preserva negrito e listas após salvar e reabrir", async ({
  page,
}) => {
  const nav = page.getByRole("navigation", { name: "Seções do admin" });
  await nav.getByRole("link", { name: "Páginas", exact: true }).click();
  await page.getByRole("link", { name: "Editar Sobre", exact: true }).click();
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
  await page.getByRole("button", { name: "Salvar página" }).click();
  await expect(page).toHaveURL("/admin/paginas");
  await page.goto("/sobre");
  await expect(page.getByRole("main").locator("li strong")).toHaveText(
    "Contribuições para a casa",
  );
  await page.goto("/admin");
  await nav.getByRole("link", { name: "Páginas", exact: true }).click();
  await page.getByRole("link", { name: "Editar Sobre", exact: true }).click();
  await expect(editor.locator("li strong")).toHaveText(
    "Contribuições para a casa",
  );
  await expect(page.getByRole("heading", { name: "Editar Sobre", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Título", { exact: true })).toHaveValue("Sobre");
  await expect(page.getByLabel("Slug", { exact: true })).toHaveValue("sobre");
  await editor.fill("");
  await page.getByRole("button", { name: "Salvar página" }).click();
  await expect(
    page.getByText("Escreva o conteúdo da página antes de publicar."),
  ).toBeVisible();
});

test("páginas mantém rascunhos, publica conteúdo e permite criar outras páginas", async ({ page }) => {
  await page.goto("/admin/paginas");
  await expect(page.getByRole("heading", { name: "Sobre", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Termos de uso", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Política de privacidade", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Editar Termos de uso", exact: true }).click();
  await page.getByRole("textbox", { name: "Conteúdo da página Termos de uso" }).fill("Croins não têm valor monetário.");
  await page.getByRole("button", { name: "Salvar página", exact: true }).click();
  await expect(page).toHaveURL("/admin/paginas");
  await page.goto("/termos");
  await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Termos de uso" })).toHaveCount(0);
  await page.goto("/admin/paginas/termos");
  await expect(page.getByRole("textbox", { name: "Conteúdo da página Termos de uso" })).toContainText("Croins não têm valor monetário.");
  await page.getByRole("switch", { name: "Publicar página" }).check();
  await page.getByRole("button", { name: "Salvar página", exact: true }).click();
  await expect(page).toHaveURL("/admin/paginas");
  await page.goto("/termos");
  await expect(page.getByRole("heading", { name: "Termos de uso", exact: true })).toBeVisible();
  await expect(page.getByRole("contentinfo").getByRole("link", { name: "Termos de uso" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("main")).toContainText("Croins não têm valor monetário.");
  await page.goto("/admin/paginas/nova");
  await page.getByLabel("Título", { exact: true }).fill("Perguntas frequentes");
  await page.getByLabel("Slug", { exact: true }).fill("admin");
  await page.getByRole("button", { name: "Salvar página", exact: true }).click();
  await expect(page.getByText(/Informe um título e um endereço válido/)).toBeVisible();
  await page.getByLabel("Slug", { exact: true }).fill("perguntas");
  await page.getByRole("textbox", { name: "Conteúdo da página nova" }).fill("Como conseguir Croins?");
  await page.getByRole("switch", { name: "Publicar página" }).check();
  await page.getByRole("button", { name: "Salvar página", exact: true }).click();
  await expect(page).toHaveURL("/admin/paginas");
  await page.goto("/perguntas");
  await expect(page.getByRole("heading", { name: "Perguntas frequentes", exact: true })).toBeVisible();
  await page.goto("/admin/sobre");
  await expect(page).toHaveURL("/admin/paginas/sobre");
  await expect(page.getByRole("textbox", { name: "Conteúdo da página Sobre" })).toContainText("Seu azar.");
  await page.getByLabel("Título", { exact: true }).fill("A casa");
  await page.getByLabel("Slug", { exact: true }).fill("a-casa");
  await page.getByRole("button", { name: "Salvar página", exact: true }).click();
  await expect(page).toHaveURL("/admin/paginas");
  await page.reload();
  await expect(page.getByRole("link", { name: "Editar A casa", exact: true })).toHaveAttribute("href", "/admin/paginas/a-casa");
  await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "A casa", exact: true }).first()).toHaveAttribute("href", "/a-casa");
  await page.goto("/a-casa");
  await expect(page.getByRole("main")).toContainText("Seu azar.");
});
