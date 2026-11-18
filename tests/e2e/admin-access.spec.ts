import { expect, test } from "@playwright/test";

test("visitante acessando admin recebe página não encontrada sem convite de login", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "404", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Seções do admin" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Entre na sua conta para acessar o painel local."),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("header").first()).not.toContainText("Admin");
  await expect(page).not.toHaveTitle(/Admin/);
});

test("usuário comum não vê link e não entra pela URL direta", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("croebet:demo-username", "UsuarioComum"),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Conta de UsuarioComum" })
    .last()
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Admin", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "404", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Seções do admin" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "404", exact: true }),
  ).toBeVisible();
});

test("admin configurado acessa e perde acesso ao sair sem recarregar", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("croebet:demo-username", "AdminTeste");
      sessionStorage.setItem("seeded", "true");
    }
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Conta de AdminTeste" })
    .last()
    .click();
  await page.getByRole("menuitem", { name: "Admin", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Seções do admin" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Conta de AdminTeste" })
    .last()
    .click();
  await page.getByRole("menuitem", { name: "Sair", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "404", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Seções do admin" }),
  ).toHaveCount(0);
});
