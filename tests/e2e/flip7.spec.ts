import { expect, test, type Page } from "@playwright/test";
import { automaticAction, botAction, createGame, transition } from "../../features/games/flip7/engine";
import type { Card, Game } from "../../features/games/flip7/engine";

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
  await expect(page.getByRole("button", { name: /^Adicionar jogador / })).toHaveCount(3);
  await page.getByRole("combobox", { name: "Número de jogadores" }).selectOption("2");
  await expect(page.getByRole("button", { name: "Começar partida", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Adicionar jogador 2", exact: true }).click();
  const participant = page.getByRole("dialog");
  await participant.getByLabel("Nome", { exact: true }).fill("Jogador 2");
  await participant.getByLabel("Tipo", { exact: true }).selectOption("human");
  await participant.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(participant).not.toBeVisible();
  await page.evaluate(() => { Math.random = () => 42 / 4294967296; });
  await page.getByRole("button", { name: "Começar partida" }).click();
  await expect(page.getByRole("region", { name: "Mesa de Flip7", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Comprar", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-flying-card]")).toHaveCount(1);
  await expect(page.locator("[data-flying-card]")).toHaveCount(0);
  // Fixed seed keeps the two-human flow reproducible.
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

test("Flip7 mantém uma única partida e a retoma automaticamente", async ({ page }) => {
  const code = "ABCDEF123456";
  let game = createGame([{ name: "Marco", kind: "human" }, { name: "Pessoa", kind: "human" }], 42);
  for (let step = 0; step < 30; step++) {
    const action = automaticAction(game) ?? (game.pending ? botAction(game) : null);
    if (!action) break;
    game = transition(game, action);
  }
  await page.goto("/jogos/flip7");
  await page.evaluate(({ code, game }) => {
    localStorage.setItem("croebet:flip7:match", JSON.stringify({ version: 1, code, game }));
  }, { code, game });
  await page.reload();
  const board = page.getByRole("region", { name: "Mesa de Flip7", exact: true });
  await expect(board).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`partida=${code}`));
  const before = await board.innerText();
  await page.reload();
  await expect(board).toHaveText(before);
  await page.goto("/jogos");
  await page.goto("/jogos/flip7");
  await expect(board).toHaveText(before);
  await expect(page).toHaveURL(new RegExp(`partida=${code}`));
  await expect(page.getByLabel("Código da partida", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Começar partida", exact: true })).toHaveCount(0);
});

// Real deck fixtures preserve IDs and avoid depending on random cards or timing.
function scenario(draws: [Card["type"], number?][]) {
  const game = createGame([{ name: "Marco", kind: "human" }, { name: "Pessoa", kind: "human" }], 42);
  const take = (type: Card["type"], value = 0) => {
    const index = game.deck.findIndex(card => card.type === type && card.value === value);
    if (index < 0) throw new Error(`Carta indisponível: ${type} ${value}`);
    return game.deck.splice(index, 1)[0];
  };
  game.players.forEach((player, i) => { player.cards = [take("number", i + 8)]; player.hasDrawn = true; });
  const top = draws.map(([type, value]) => take(type, value));
  game.deck.push(...top.reverse());
  return game;
}
async function restore(page: Page, game: Game) {
  await page.goto("/jogos/flip7");
  await page.evaluate(game => {
    localStorage.setItem("croebet:flip7:match", JSON.stringify({ version: 1, code: "ABCDEF123456", game }));
  }, game);
  await page.reload();
  await expect(page.getByRole("region", { name: "Mesa de Flip7", exact: true })).toBeVisible();
}
async function savedGame(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("croebet:flip7:match")!).game as Game);
}

test("Congelar pendente sobrevive ao reload, anima a entrega e mantém a carta com o alvo", async ({ page }) => {
  const game = transition(scenario([["freeze"]]), { type: "draw" });
  await restore(page, game);
  await expect(page.getByRole("button", { name: "Escolher Pessoa", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Comprar", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Escolher Pessoa", exact: true }).click();
  await expect(page.locator("[data-flying-card]")).toHaveCount(1);
  await expect(page.locator("[data-flying-card]")).toHaveCount(0);
  const hand = page.getByRole("region", { name: "Mesa de Pessoa", exact: true });
  await expect(hand).toContainText("Congelado");
  await expect(hand.getByRole("img", { name: "Congelar", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Comprar", exact: true })).toBeVisible();
  const saved = await savedGame(page);
  await page.reload();
  expect(await savedGame(page)).toEqual(saved);
  await expect(hand).toContainText("Congelado");
});

test("retomar Compre 3 completa somente as compras restantes", async ({ page }) => {
  let game = scenario([["three"], ["number", 2], ["number", 3], ["number", 4]]);
  game = transition(transition(game, { type: "draw" }), { type: "target", target: 1 });
  game = transition(game, { type: "step" }); // first forced draw was already saved
  const expected = transition(transition(game, { type: "step" }), { type: "step" });
  await restore(page, game);
  await expect(page.getByRole("button", { name: "Comprar", exact: true })).toBeVisible();
  expect(await savedGame(page)).toEqual(JSON.parse(JSON.stringify(expected)));
  const hand = page.getByRole("region", { name: "Mesa de Pessoa", exact: true });
  await expect(hand.getByRole("img", { name: "Compre 3", exact: true })).toHaveCount(1);
  await page.reload();
  expect(await savedGame(page)).toEqual(JSON.parse(JSON.stringify(expected)));
});

test("estouro vira a mão, encerra a rodada e próxima rodada preserva o placar", async ({ page }) => {
  const game = scenario([["number", 8]]);
  game.players[1].status = "stayed";
  await restore(page, game);
  await page.getByRole("button", { name: "Comprar", exact: true }).click();
  await expect(page.locator("[data-flying-card]")).toHaveCount(0);
  const hand = page.getByRole("region", { name: "Mesa de Marco", exact: true });
  await expect(hand).toContainText("Estourou");
  await expect(hand.getByRole("img", { name: "Carta de costas", exact: true })).toHaveCount(2);
  const summary = await savedGame(page);
  expect(summary.phase).toBe("summary");
  expect(summary.players.map(p => p.total)).toEqual([0, 9]);
  await page.reload();
  expect(await savedGame(page)).toEqual(summary);
  await page.getByRole("button", { name: "Próxima rodada", exact: true }).click();
  await expect.poll(async () => (await savedGame(page)).round).toBe(2);
  expect((await savedGame(page)).players.map(p => p.total)).toEqual([0, 9]);
});

test("fim de partida restaura vencedores empatados e Jogar novamente limpa o salvamento", async ({ page }) => {
  const game = scenario([]);
  game.players.forEach(p => { p.total = 200; p.status = "stayed"; });
  game.history = [[200, 200]]; game.phase = "over";
  await restore(page, game);
  await expect(page.getByRole("heading", { name: "Marco e Pessoa venceram!", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Comprar", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Jogar novamente", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Número de jogadores" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("croebet:flip7:match"))).toBeNull();
  await expect(page).not.toHaveURL(/partida=/);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Número de jogadores" })).toBeVisible();
});

test("configuração suporta 12 vagas e preserva edição ao reduzir e aumentar os lugares", async ({ page }) => {
  await page.goto("/jogos/flip7");
  await page.getByRole("combobox", { name: "Número de jogadores" }).selectOption("12");
  await expect(page.getByRole("button", { name: /^Adicionar jogador / })).toHaveCount(11);
  await page.getByRole("button", { name: "Adicionar jogador 12", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome", { exact: true }).fill("Bot 12");
  await dialog.getByLabel("Tipo", { exact: true }).selectOption("normal");
  await dialog.getByRole("button", { name: "Adicionar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Editar Bot 12", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Número de jogadores" }).selectOption("2");
  await page.getByRole("combobox", { name: "Número de jogadores" }).selectOption("12");
  await page.getByRole("button", { name: "Editar Bot 12", exact: true }).click();
  await expect(dialog.getByLabel("Nome", { exact: true })).toHaveValue("Bot 12");
  await expect(dialog.getByLabel("Tipo", { exact: true })).toHaveValue("normal");
  await dialog.getByRole("button", { name: "Remover", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Adicionar jogador / })).toHaveCount(11);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Segunda chance recebe a duplicada e anima o descarte das duas cartas", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const game = scenario([["number", 8]]);
  const chanceIndex = game.deck.findIndex(card => card.type === "chance");
  const chance = game.deck.splice(chanceIndex, 1)[0];
  game.players[0].cards.push(chance);
  const duplicate = game.deck.at(-1)!;
  await restore(page, game);
  const hand = page.getByRole("region", { name: "Mesa de Marco", exact: true });
  await page.getByRole("button", { name: "Comprar", exact: true }).click();
  await expect(page.locator("[data-flying-card]")).toHaveCount(1);
  await expect(hand.getByRole("img", { name: "Segunda chance", exact: true })).toHaveCount(1);
  const arriving = hand.locator(`[data-flight-card="${duplicate.id}"]`);
  await expect(arriving).toBeVisible();
  await expect(page.getByRole("button", { name: "Comprar", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-flying-card]")).toHaveCount(0);
  await expect(arriving).toHaveCount(0);
  await expect(hand.getByRole("img", { name: "Segunda chance", exact: true })).toHaveCount(0);
  await expect(hand.getByRole("img", { name: "8", exact: true })).toHaveCount(1);
  const saved = await savedGame(page);
  expect(saved.discard.map((card: Card) => card.id)).toEqual(expect.arrayContaining([chance.id, duplicate.id]));
  expect(saved.players[0].status).toBe("playing");
});
