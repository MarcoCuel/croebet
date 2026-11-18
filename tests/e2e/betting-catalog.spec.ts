import { expect, test } from "@playwright/test";

test("busca e filtros de apostas combinam e preservam o palpite em minutos", async ({
  page,
}) => {
  await page.goto("/apostas");
  const catalog = page.getByRole("region", { name: "Apostas abertas" });
  const articles = catalog.locator("article");
  const minutes = catalog.getByLabel("Atraso em minutos");
  await minutes.fill("23");
  await catalog
    .getByRole("button", { name: "Sim ou não", exact: true })
    .click();
  await expect(articles).toHaveCount(1);
  await expect(
    catalog.getByRole("button", { name: "Sim", exact: true }),
  ).toBeVisible();
  const search = catalog.getByRole("searchbox", { name: "Buscar apostas" });
  await search.fill("horarios");
  await expect(articles).toHaveCount(0);
  await expect(catalog.getByText("Nenhuma aposta encontrada.")).toBeVisible();
  await catalog.getByRole("button", { name: "Limpar filtros" }).click();
  await expect(search).toHaveValue("");
  await expect(articles).toHaveCount(3);
  await expect(minutes).toHaveValue("23");
  await search.fill("  minutos  ");
  await expect(articles).toHaveCount(1);
  await search.fill("live");
  await catalog.getByRole("button", { name: "Opções", exact: true }).click();
  await expect(articles).toHaveCount(1);
  await expect(
    catalog.getByRole("heading", { name: "Quanto tempo a live vai durar?" }),
  ).toBeVisible();
});

test("regras ficam acessíveis sem login e devolvem o foco ao fechar", async ({
  page,
}) => {
  await page.goto("/apostas");
  const trigger = page.getByRole("button", {
    name: "Regras: Ela vai começar a live de peruca?",
    exact: true,
  });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Ela vai começar a live de peruca?" }),
  ).toBeVisible();
  await expect(dialog.getByText("Prazo ainda não definido.")).toBeVisible();
  await expect(
    dialog.getByText(/proporcionalmente ao valor de cada aposta/),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
