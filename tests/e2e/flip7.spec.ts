import { expect, test } from "@playwright/test";

test("Flip7 abre pelo catálogo, funciona localmente e mantém controles acessíveis", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/jogos");
  await page.locator('a[href="/jogos/flip7"]').click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Flip7");
  await page.getByRole("button", { name: "Regras", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("200");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Regras", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Entrar para jogar", exact: true }).click();
  const login = page.getByRole("dialog");
  await login.getByLabel("Nome de usuário").fill("Marco");
  await login.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await login.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(login).not.toBeVisible();
  await expect(page.getByRole("combobox", { name: "Tipo do participante 1" })).toHaveCount(0);
  await expect(page.locator('[data-slot="input"]')).toHaveCount(0);
  await page.getByRole("combobox", { name: "Número de jogadores" }).selectOption("4");
  await expect(page.getByRole("combobox")).toHaveCount(4);
  await page.getByRole("combobox", { name: "Número de jogadores" }).selectOption("2");
  await page.getByRole("combobox", { name: "Tipo do participante 2" }).selectOption("human");
  await page.getByRole("button", { name: "Começar partida" }).click();
  await expect(page.getByRole("heading", { name: /^Vez de Marco/ })).toContainText("Distribuindo a primeira carta");
  await expect(page.getByRole("button", { name: "Comprar", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-flying-card]")).toHaveCount(1);
  await expect(page.locator("[data-flying-card]")).toHaveCount(0);
  // Real random draws, including target selection, exercise the two-human turn flow.
  for (let i = 0; i < 8; i++) {
    const target = page.getByRole("button", { name: /^Escolher / }).first();
    if (await target.count()) await target.click();
    else if (await page.getByRole("button", { name: "Comprar", exact: true }).count()) {
      await page.getByRole("button", { name: "Comprar", exact: true }).click();
      await expect(page.locator("[data-flying-card]")).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Comprar", exact: true })).toHaveCount(0);
      await expect(page.locator("[data-flying-card]")).toHaveCount(0);
      for (const hand of await page.getByRole("region", { name: /^Mesa de / }).all()) {
        if (await hand.getByText("Estourou", { exact: true }).count()) {
          const cards = hand.getByRole("img");
          for (const card of await cards.all()) await expect(card).toHaveAccessibleName("Carta de costas");
        }
      }
    }
    else break;
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole("heading", { name: "Últimas jogadas" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Placar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Regras", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nova partida", exact: true })).toHaveCount(0);
  const history = page.getByRole("complementary", { name: "Histórico da partida" });
  await page.getByRole("button", { name: "Esconder histórico", exact: true }).click();
  await expect(history).not.toBeVisible();
  await page.getByRole("button", { name: "Mostrar histórico", exact: true }).click();
  await expect(history).toBeVisible();
  expect(errors).toEqual([]);
});
