import { expect, test, type Page } from "@playwright/test";
import { automaticAction, botAction, createGame, transition } from "../../features/games/flip7/engine";
import type { Card, Game, GameOptions } from "../../features/games/flip7/engine";

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

test("Flip7 lista a partida salva e mantém a retomada após recarregar", async ({ page }) => {
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
  await expect(page.getByRole("heading", { name: "Partidas em andamento", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continuar partida", exact: true }).click();
  const board = page.getByRole("region", { name: "Mesa de Flip7", exact: true });
  await expect(board).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`partida=${code}`));
  const before = await board.innerText();
  await page.reload();
  await expect(board).toHaveText(before);
  await page.goto("/jogos");
  await page.goto("/jogos/flip7");
  await expect(board).toHaveCount(0);
  await page.getByRole("button", { name: "Continuar partida", exact: true }).click();
  await expect(board).toHaveText(before);
  await expect(page).toHaveURL(new RegExp(`partida=${code}`));
  await expect(page.getByLabel("Código da partida", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Começar partida", exact: true })).toHaveCount(0);
});

test("configuração divide opções e jogadores, com partidas em andamento abaixo", async ({ page, isMobile }) => {
  await page.goto("/jogos/flip7");
  const active = ["ABCDEF123456", "123456ABCDEF", "AABBCCDDEEFF"].map(code => ({ version: 1, code, game: scenario([]) }));
  const finished = structuredClone(active[0]);
  finished.code = "112233445566";
  finished.game.phase = "over";
  finished.game.players.forEach(player => { player.status = "stayed"; player.total = 200; });
  finished.game.history = [[200, 200]];
  await page.evaluate(matches => {
    localStorage.setItem("croebet:demo-username", "Marco");
    localStorage.setItem("croebet:flip7:match", JSON.stringify({ version: 2, matches }));
  }, [...active, finished]);
  await page.reload();
  const list = page.getByRole("complementary", { name: "Partidas em andamento" });
  await expect(list.getByRole("button", { name: "Continuar partida", exact: true })).toHaveCount(3);
  const count = page.getByRole("combobox", { name: "Número de jogadores", exact: true });
  await expect(count).toBeVisible();
  await expect(page.getByText("Partida finalizada", { exact: true })).toHaveCount(0);
  const optionsCard = page.getByRole("region", { name: "Opções da partida", exact: true });
  const playersCard = page.getByRole("region", { name: "Jogadores da partida", exact: true });
  await expect(optionsCard.getByRole("combobox", { name: "Versão do Flip7" })).toBeVisible();
  await expect(optionsCard.getByRole("button", { name: "Regras", exact: true })).toBeVisible();
  await expect(playersCard.getByRole("combobox", { name: "Número de jogadores", exact: true })).toBeVisible();
  await expect(playersCard.getByRole("button", { name: "Começar partida", exact: true })).toBeVisible();
  const optionsBox = await optionsCard.boundingBox();
  const playersBox = await playersCard.boundingBox();
  const listBox = await list.boundingBox();
  expect(listBox!.y).toBeGreaterThanOrEqual(Math.max(optionsBox!.y + optionsBox!.height, playersBox!.y + playersBox!.height));
  if (isMobile) expect(playersBox!.y).toBeGreaterThan(optionsBox!.y);
  else expect(playersBox!.x).toBeGreaterThan(optionsBox!.x);
  await page.getByRole("switch", { name: "Jogar com Croins", exact: true }).check();
  await page.getByRole("button", { name: "Pagar 50 Croins e jogar", exact: true }).click();
  await expect(page.getByRole("region", { name: "Mesa de Flip7", exact: true })).toBeVisible();
  const newCode = new URL(page.url()).searchParams.get("partida")!;
  expect([...active, finished].some(match => match.code === newCode)).toBe(false);
  const savedCodes = await page.evaluate(() => JSON.parse(localStorage.getItem("croebet:flip7:match")!).matches.map((match: { code: string }) => match.code));
  expect(savedCodes).toEqual(expect.arrayContaining([...active, finished].map(match => match.code)));
  expect(savedCodes).toHaveLength(5);
  await page.goto("/jogos/flip7");
  await expect(list.getByRole("button", { name: "Continuar partida", exact: true })).toHaveCount(4);
  await expect(count).toBeVisible();
  await list.getByRole("button", { name: "Continuar partida", exact: true }).first().click();
  await expect(page).toHaveURL(/partida=ABCDEF123456/);
  expect(await savedGame(page)).toEqual(active[0].game);
});

// Real deck fixtures preserve IDs and avoid depending on random cards or timing.
function scenario(draws: [Card["type"], number?][], options?: GameOptions) {
  const game = createGame([{ name: "Marco", kind: "human" }, { name: "Pessoa", kind: "human" }], 42, options);
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
  await page.goto("/jogos/flip7?partida=ABCDEF123456");
  await expect(page.getByRole("region", { name: "Mesa de Flip7", exact: true })).toBeVisible();
}
async function savedGame(page: Page) {
  return page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("croebet:flip7:match")!);
    const code = new URLSearchParams(location.search).get("partida");
    return (stored.version === 2 ? stored.matches.find((match: { code: string }) => match.code === code) ?? stored.matches.at(-1) : stored).game as Game;
  });
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
  await expect(page.locator("[data-flying-card]")).toHaveCount(1);
  const during = page.getByRole("region", { name: "Mesa de Marco", exact: true });
  await expect(during).not.toContainText("Estourou");
  await expect(during.getByText("8 pts", { exact: true })).toBeVisible();
  await expect(during.getByRole("img", { name: "Carta de costas", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Próxima rodada", exact: true })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Histórico da partida" })).not.toContainText("Marco estourou");
  await expect(page.locator("[data-flying-card]")).toHaveCount(0);
  const hand = page.getByRole("region", { name: "Mesa de Marco", exact: true });
  await expect(hand).toContainText("Estourou");
  await expect(hand.getByRole("img", { name: "Carta de costas", exact: true })).toHaveCount(2);
  const summary = await savedGame(page);
  expect(summary.phase).toBe("summary");
  expect(summary.players.map(p => p.total)).toEqual([0, 9]);
  await page.reload();
  expect(await savedGame(page)).toEqual(summary);
  await expect(page.getByRole("button", { name: "Próxima rodada", exact: true })).toHaveCount(0);
  await expect.poll(async () => (await savedGame(page)).round).toBe(2);
  expect((await savedGame(page)).players.map(p => p.total)).toEqual([0, 9]);
});

test("Jogar novamente preserva a partida finalizada e permite reabrir o resultado pela URL", async ({ page }) => {
  const game = scenario([]);
  game.players.forEach(p => { p.total = 200; p.status = "stayed"; });
  game.history = [[200, 200]]; game.phase = "over";
  await restore(page, game);
  const result = page.getByRole("dialog", { name: "Resultado da partida", exact: true });
  await expect(result).toBeVisible();
  await expect(result).toContainText("Marco e Pessoa venceram!");
  await expect(result.getByRole("list", { name: "Classificação final" }).getByRole("listitem")).toHaveCount(2);
  await expect(result.getByText("200 pts", { exact: true })).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(result).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Ver resultado", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Ver resultado", exact: true }).click();
  await expect(result).toBeVisible();
  await expect(page.getByRole("button", { name: "Comprar", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Jogar novamente", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Número de jogadores" })).toBeVisible();
  expect(await savedGame(page)).toEqual(game);
  await expect(page.getByRole("complementary", { name: "Partidas em andamento" })).toHaveCount(0);
  await expect(page).not.toHaveURL(/partida=/);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Número de jogadores" })).toBeVisible();
  await page.goto("/jogos/flip7?partida=ABCDEF123456");
  await expect(result).toBeVisible();
  await expect(result).toContainText("Marco e Pessoa venceram!");
  expect(await savedGame(page)).toEqual(game);
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

test("controles do Flip7 ficam fixos no centro inferior da tela", async ({ page }) => {
  await restore(page, scenario([["number", 2]]));
  const controls = page.locator("[data-flip7-controls]");
  await expect(controls).toHaveCSS("position", "fixed");
  await expect(controls.getByRole("button", { name: "Comprar", exact: true })).toBeVisible();
  await expect(controls.getByRole("button", { name: "Parar", exact: true })).toBeVisible();
  const box = (await controls.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(1);
  expect(viewport.height - box.y - box.height).toBeLessThanOrEqual(32);
  expect(box.y + box.height).toBeLessThan(viewport.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("a mão só abre espaço quando a carta começa a chegar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await restore(page, scenario([["number", 6]]));
  const hand = page.getByRole("region", { name: "Mesa de Marco", exact: true });
  const eight = hand.getByRole("img", { name: "8", exact: true });
  const before = (await eight.boundingBox())!;
  await page.getByRole("button", { name: "Comprar", exact: true }).click();
  await expect(page.locator("[data-flying-card]")).toHaveCount(1);
  const duringReveal = (await eight.boundingBox())!;
  expect(Math.abs(duringReveal.x - before.x)).toBeLessThan(1);
  expect(Math.abs(duringReveal.width - before.width)).toBeLessThan(1);
  await expect(page.locator("[data-flying-card]")).toHaveCount(0);
  const after = (await eight.boundingBox())!;
  const six = (await hand.getByRole("img", { name: "6", exact: true }).boundingBox())!;
  expect(six.x).toBeLessThan(after.x);
  expect(after.x).toBeGreaterThan(before.x);
});

test("voltar do Flip7 navega sem abandonar e permite continuar pela página do jogo", async ({ page, isMobile }) => {
  await restore(page, scenario([["number", 6]]));
  const before = await savedGame(page);
  if (isMobile) await page.goto("/jogos/flip7");
  else await page.getByRole("link", { name: "Voltar para Flip7", exact: true }).click();
  await expect(page).toHaveURL(/\/jogos\/flip7$/);
  await expect(page.getByRole("dialog", { name: "Abandonar partida?" })).toHaveCount(0);
  expect(await savedGame(page)).toEqual(before);
  await page.goto("/jogos/flip7");
  await expect(page.getByRole("heading", { name: "Partidas em andamento", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Número de jogadores", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continuar partida", exact: true }).click();
  await expect(page.getByRole("region", { name: "Mesa de Flip7", exact: true })).toBeVisible();
  expect(await savedGame(page)).toEqual(before);
  await page.getByRole("button", { name: "Abandonar partida", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Abandonar partida?" });
  await dialog.getByRole("button", { name: "Abandonar partida", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Número de jogadores", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("croebet:flip7:match"))).toBeNull();
});

test("voltar de uma partida finalizada abre a página do Flip7 e preserva o resultado", async ({ page, isMobile }) => {
  const game = scenario([]);
  game.players.forEach(player => { player.total = 200; player.status = "stayed"; });
  game.history = [[200, 200]];
  game.phase = "over";
  await restore(page, game);
  await expect(page.getByRole("dialog", { name: "Resultado da partida", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  if (isMobile) await page.goto("/jogos/flip7");
  else {
    const back = page.getByRole("link", { name: "Voltar para Flip7", exact: true });
    await expect(back).toHaveAttribute("href", "/jogos/flip7");
    await back.click();
  }
  await expect(page).toHaveURL(/\/jogos\/flip7$/);
  await expect(page.getByRole("heading", { name: "Partida finalizada", exact: true })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Partidas em andamento" })).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Número de jogadores", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Mesa de Flip7", exact: true })).toHaveCount(0);
  expect((await savedGame(page)).phase).toBe("over");
  if (!isMobile) await expect(page.getByRole("link", { name: "Voltar para Jogos", exact: true })).toHaveAttribute("href", "/jogos");
  await page.goto("/jogos/flip7?partida=ABCDEF123456");
  await expect(page.getByRole("dialog", { name: "Resultado da partida", exact: true })).toBeVisible();
});

test("configuração seleciona Vingança e Brutal e adapta as regras", async ({ page }) => {
  await page.goto("/jogos/flip7");
  await page.evaluate(() => localStorage.setItem("croebet:demo-username", "Marco"));
  await page.reload();
  await expect(page.getByRole("switch", { name: "Modo Brutal" })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Versão do Flip7" }).selectOption("vengeance");
  const brutalSwitch = page.getByRole("switch", { name: "Modo Brutal" });
  await expect(brutalSwitch).not.toBeChecked();
  await brutalSwitch.focus(); await page.keyboard.press("Space");
  await expect(brutalSwitch).toBeChecked();

  await page.getByRole("button", { name: "Regras", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Brutal");
  await expect(page.getByRole("dialog")).toContainText("A pontuação pode ser negativa");
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "Versão do Flip7" }).selectOption("classic");
  await expect(page.getByRole("switch", { name: "Modo Brutal" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("combobox", { name: "Versão do Flip7" }).selectOption("vengeance");
  await page.getByRole("switch", { name: "Modo Brutal" }).check();
  await page.getByRole("button", { name: "Adicionar jogador 2", exact: true }).click();
  const participant = page.getByRole("dialog");
  await participant.getByLabel("Nome", { exact: true }).fill("Pessoa");
  await participant.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Começar partida", exact: true }).click();
  await expect(page.getByRole("region", { name: "Mesa de Flip7", exact: true })).toBeVisible();
  const saved = await savedGame(page);
  expect(saved.mode).toBe("vengeance"); expect(saved.brutal).toBe(true);
});

test("Vingança permite roubar de quem parou, anima a transferência e retoma a escolha", async ({ page }) => {
  let game = scenario([["steal"]], { mode: "vengeance", brutal: false });
  game.players[1].status = "stayed";
  game = transition(game, { type: "draw" });
  await restore(page, game);
  await expect(page.getByRole("button", { name: "Marco vai roubar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirmar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Selecionar 9 de Pessoa", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Selecionar 9 de Pessoa", exact: true }).click();
  await expect(page.locator("[data-moving-card]")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Comprar", exact: true })).toHaveCount(0);
  await expect(page.locator("[data-moving-card]")).toHaveCount(0);
  const hand = page.getByRole("region", { name: "Mesa de Marco", exact: true });
  await expect(hand.getByRole("img", { name: "9", exact: true })).toBeVisible();
  const saved = await savedGame(page);
  expect(saved.mode).toBe("vengeance");
  expect(saved.players[1].status).toBe("stayed");
  expect(saved.players[1].cards).toHaveLength(0);
  await page.reload();
  await expect(hand.getByRole("img", { name: "9", exact: true })).toBeVisible();
});

test("Trocar anima uma prévia local reversível e só efetiva ao confirmar", async ({ page }) => {
  const game = transition(scenario([["swap"]], { mode: "vengeance", brutal: false }), { type: "draw" });
  await restore(page, game);
  await expect(page.getByRole("button", { name: /^Escolher / })).toHaveCount(0);
  const confirm = page.getByRole("button", { name: "Confirmar", exact: true });
  await expect(confirm).toBeDisabled();
  const before = await savedGame(page);
  const first = page.getByRole("button", { name: "Selecionar 8 de Marco", exact: true });
  const second = page.getByRole("button", { name: "Selecionar 9 de Pessoa", exact: true });
  const marco = page.getByRole("region", { name: "Mesa de Marco", exact: true });
  const pessoa = page.getByRole("region", { name: "Mesa de Pessoa", exact: true });
  await first.focus(); await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await second.click();
  await expect(page.locator("[data-moving-card]")).toHaveCount(2);
  await expect(page.locator("[data-moving-card]")).toHaveCount(0);
  await expect(marco.getByRole("img", { name: "9", exact: true })).toBeVisible();
  expect(await savedGame(page)).toEqual(before);
  await expect(confirm).toBeEnabled();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.locator("[data-moving-card]")).toHaveCount(2);
  await expect(page.locator("[data-moving-card]")).toHaveCount(0);
  await expect(marco.getByRole("img", { name: "8", exact: true })).toBeVisible();
  await expect(pessoa.getByRole("img", { name: "9", exact: true })).toBeVisible();
  expect(await savedGame(page)).toEqual(before);
  await first.click(); await second.click();
  await expect(page.locator("[data-moving-card]")).toHaveCount(0);
  await confirm.click();
  await expect(marco.getByRole("img", { name: "9", exact: true })).toBeVisible();
  await expect(pessoa.getByRole("img", { name: "8", exact: true })).toBeVisible();
  const committed = await savedGame(page);
  expect(committed.players[0].cards[0].value).toBe(9);
  expect(committed.players[1].cards[0].value).toBe(8);
  await page.reload();
  await expect(marco.getByRole("img", { name: "9", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Flip7 Brutal retoma a escolha e permite tirar 15 de quem já estourou", async ({ page }) => {
  let game = scenario([], { mode: "vengeance", brutal: true });
  for (const value of [1, 2, 3, 4, 5, 6]) {
    const index = game.deck.findIndex(c => c.type === "number" && c.value === value);
    game.players[0].cards.push(game.deck.splice(index, 1)[0]);
  }
  game.players[1].status = "busted";
  game.players[1].bustedCards = game.players[1].cards.map(c => c.id);
  const last = game.players[0].cards.pop()!; game.deck.push(last);
  game = transition(game, { type: "draw" });
  await restore(page, game);
  await expect(page.getByRole("button", { name: "Ganhar 15 pontos", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Tirar 15 pontos de Pessoa", exact: true }).click();
  await expect(page.getByRole("button", { name: "Próxima rodada", exact: true })).toHaveCount(0);
  const saved = await savedGame(page);
  expect(saved.history).toEqual([[29, -15]]);
  await page.reload();
  expect((await savedGame(page)).history).toEqual([[29, -15]]);
});

test("O Zero bloqueia Parar e o Brutal mantém modificador novo visível para quem estourou", async ({ page }) => {
  let game = scenario([["zero"]], { mode: "vengeance", brutal: true });
  game = transition(game, { type: "draw" });
  game.turn = 0;
  await restore(page, game);
  await expect(page.getByRole("button", { name: "Parar", exact: true })).toHaveCount(0);
  game = scenario([["minus", 10]], { mode: "vengeance", brutal: true });
  game.players[1].status = "busted";
  game.players[1].bustedCards = game.players[1].cards.map(c => c.id);
  game = transition(game, { type: "draw" });
  await restore(page, game);
  await page.getByRole("button", { name: "Escolher Pessoa", exact: true }).click();
  await expect(page.locator("[data-flying-card]")).toHaveCount(0);
  const hand = page.getByRole("region", { name: "Mesa de Pessoa", exact: true });
  await expect(hand.getByRole("img", { name: "−10", exact: true })).toBeVisible();
  await expect(hand.getByRole("img", { name: "Carta de costas", exact: true })).toHaveCount(1);
  await expect(hand.getByText("-10 pts", { exact: true })).toBeVisible();
  await page.reload();
  await expect(hand.getByRole("img", { name: "−10", exact: true })).toBeVisible();
});

test("Descartar remove a carta própria com um clique e sem selecionar participante", async ({ page }) => {
  let game = scenario([["remove"]], { mode: "vengeance", brutal: false });
  const index = game.deck.findIndex(c => c.type === "minus" && c.value === 10);
  const bad = game.deck.splice(index, 1)[0];
  game.players[0].cards.push(bad);
  game.players[1].kind = "normal";
  game = transition(game, { type: "draw" });
  await restore(page, game);
  await expect(page.getByRole("button", { name: "Marco escolhe a carta para descartar", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Confirmar", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Selecionar −10 de Marco", exact: true }).click();
  await expect(page.locator("[data-moving-card]")).toHaveCount(1);
  // Persisting precedes animation and the bot's next action.
  const saved = await savedGame(page);
  expect(saved.discard.some(c => c.id === bad.id)).toBe(true);
  expect(saved.players[0].cards.some(c => c.id === bad.id)).toBe(false);
  await expect(page.locator("[data-moving-card]")).toHaveCount(0);
});

test("Vingança deita a primeira carta de cada linha ao passar e mantém o efeito após reload", async ({ page }) => {
  const game = scenario([], { mode: "vengeance", brutal: false });
  for (const [type, value] of [["minus", 2], ["number", 10]] as const) {
    const index = game.deck.findIndex(c => c.type === type && c.value === value);
    game.players[0].cards.push(game.deck.splice(index, 1)[0]);
  }
  await restore(page, game);
  const hand = page.getByRole("region", { name: "Mesa de Marco", exact: true });
  await expect(hand.locator("[data-card-sideways]")).toHaveCount(0);
  await page.getByRole("button", { name: "Parar", exact: true }).click();
  await expect(hand.locator("[data-card-sideways]")).toHaveCount(2);
  await expect(hand.getByRole("img", { name: "10", exact: true })).not.toHaveAttribute("data-card-sideways");
  await expect(hand.getByRole("img", { name: "Carta de costas", exact: true })).toHaveCount(0);
  const horizontal = await hand.getByRole("img", { name: "8", exact: true }).boundingBox();
  const vertical = await hand.getByRole("img", { name: "10", exact: true }).boundingBox();
  expect(horizontal).not.toBeNull(); expect(vertical).not.toBeNull();
  expect(Math.abs(horizontal!.width - vertical!.height)).toBeLessThan(2);
  expect(Math.abs(horizontal!.height - vertical!.width)).toBeLessThan(2);
  expect(Math.abs(horizontal!.y + horizontal!.height / 2 - vertical!.y - vertical!.height / 2)).toBeLessThan(2);
  expect((await savedGame(page)).players[0].status).toBe("stayed");
  await page.reload();
  await expect(hand.locator("[data-card-sideways]")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Flip7 Brutal permite clicar em si mesmo para receber o bônus de 15", async ({ page }) => {
  let game = scenario([], { mode: "vengeance", brutal: true });
  for (const value of [1, 2, 3, 4, 5, 6]) {
    const index = game.deck.findIndex(c => c.type === "number" && c.value === value);
    game.players[0].cards.push(game.deck.splice(index, 1)[0]);
  }
  game.deck.push(game.players[0].cards.pop()!);
  game = transition(game, { type: "draw" });
  await restore(page, game);
  await page.getByRole("button", { name: "Ganhar 15 pontos para Marco", exact: true }).click();
  const saved = await savedGame(page);
  expect(saved.history).toEqual([[44, 9]]);
  expect(saved.bonusTarget).toBeNull();
  await expect(page.getByRole("button", { name: "Próxima rodada", exact: true })).toHaveCount(0);
});

test("resultado final ordena todos os jogadores e preserva pontos negativos no Brutal", async ({ page }) => {
  const game = scenario([], { mode: "vengeance", brutal: true });
  game.players[0].total = -5; game.players[1].total = 220;
  game.players.forEach(p => { p.status = "stayed"; });
  game.history = [[-5, 220]]; game.phase = "over";
  await restore(page, game);
  const result = page.getByRole("dialog", { name: "Resultado da partida", exact: true });
  await expect(result).toContainText("Pessoa venceu!");
  const rows = result.getByRole("listitem");
  await expect(rows.nth(0)).toContainText("Pessoa");
  await expect(rows.nth(0)).toContainText("220 pts");
  await expect(rows.nth(1)).toContainText("Marco");
  await expect(rows.nth(1)).toContainText("-5 pts");
});

test("configuração do Flip7 preserva modo, Brutal e lugares ao sair e recarregar", async ({ page }) => {
  await page.goto("/jogos/flip7");
  await page.getByRole("combobox", { name: "Versão do Flip7" }).selectOption("vengeance");
  await page.getByRole("switch", { name: "Modo Brutal" }).check();
  await page.getByRole("combobox", { name: "Número de jogadores" }).selectOption("4");
  await page.goto("/jogos"); await page.goto("/jogos/flip7");
  await expect(page.getByRole("combobox", { name: "Versão do Flip7" })).toHaveValue("vengeance");
  await expect(page.getByRole("switch", { name: "Modo Brutal" })).toBeChecked();
  await expect(page.getByRole("combobox", { name: "Número de jogadores" })).toHaveValue("4");
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Número de jogadores" })).toHaveValue("4");
  await expect(page.getByRole("switch", { name: "Modo Brutal" })).toBeChecked();
  await page.getByRole("combobox", { name: "Versão do Flip7" }).selectOption("classic");
  await page.reload();
  await page.getByRole("combobox", { name: "Versão do Flip7" }).selectOption("vengeance");
  await expect(page.getByRole("switch", { name: "Modo Brutal" })).toBeChecked();
  await page.getByRole("switch", { name: "Modo Brutal" }).uncheck();
  await page.getByRole("combobox", { name: "Versão do Flip7" }).selectOption("classic");
  await page.getByRole("combobox", { name: "Versão do Flip7" }).selectOption("vengeance");
  await expect(page.getByRole("switch", { name: "Modo Brutal" })).not.toBeChecked();

});
