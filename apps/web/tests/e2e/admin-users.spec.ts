import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("croebet:demo-username", "AdminTeste"),
  );
});

test("usuários permite buscar, filtrar e consultar a interna sem criar contas", async ({
  page,
}) => {
  await page.goto("/admin");
  await page
    .getByRole("navigation", { name: "Seções do admin" })
    .getByRole("link", { name: "Usuários", exact: true })
    .click();
  await expect(page).toHaveURL("/admin/usuarios");
  await expect(
    page.getByRole("link", { name: /^Ver usuário / }).first(),
  ).toHaveAccessibleName("Ver usuário AdminTeste");
  const search = page.getByRole("searchbox", {
    name: "Buscar usuários no admin",
  });
  await search.fill("rafalima");
  await expect(
    page.getByRole("link", { name: "Ver usuário rafalima" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Ver usuário lunazinha" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Ativos", exact: true }).click();
  await expect(page.getByText("Nenhum usuário encontrado.")).toBeVisible();
  await search.fill("");
  await page.getByRole("button", { name: "Suspensos", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Ver usuário rafalima" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Todos", exact: true }).click();
  await search.fill("LÚNA");
  await page.getByRole("link", { name: "Ver usuário lunazinha" }).click();
  await expect(page).toHaveURL("/admin/usuarios/luna");
  await expect(
    page.getByRole("heading", { name: "Luna", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Dados da conta" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apostas", exact: true }).click();
  await expect(
    page.getByText("A Croe vai entrar de peruca na live?"),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Luna", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Bônus diário", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("croebet:demo-wallet:lunazinha"),
    ),
  ).toBeNull();
  await page
    .getByRole("link", { name: "Voltar para Usuários do admin" })
    .click();
  await expect(page).toHaveURL("/admin/usuarios");
  await page.goto("/admin/usuarios/inexistente");
  await expect(
    page.getByRole("heading", { name: "404", exact: true }),
  ).toBeVisible();
});

test("contas comuns não acessam listagem ou interna de usuários", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("croebet:demo-username", "Visitante"),
  );
  for (const path of ["/admin/usuarios", "/admin/usuarios/luna"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "404", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Dados da conta", exact: true }),
    ).toHaveCount(0);
  }
});
