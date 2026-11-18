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

test("voltar do Flip7 permite cancelar ou abandonar a partida salva", async ({ page }) => {
  await restore(page, scenario([["number", 6]]));
  const back = page.getByRole("link", { name: "Voltar para Jogos", exact: true });
  await back.click();
  const dialog = page.getByRole("dialog", { name: "Abandonar partida?" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/jogos\/flip7/);
  await dialog.getByRole("button", { name: "Continuar jogando", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(back).toBeFocused();
  expect(await savedGame(page)).toBeTruthy();
  await back.click();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await back.click();
  await dialog.getByRole("button", { name: "Abandonar partida", exact: true }).click();
  await expect(page).toHaveURL(/\/jogos$/);
  expect(await page.evaluate(() => localStorage.getItem("croebet:flip7:match"))).toBeNull();
  await page.goto("/jogos/flip7");
  await expect(page.getByRole("region", { name: "Mesa de Flip7", exact: true })).toHaveCount(0);
});

test("configuração seleciona Vingança e Brutal e adapta as regras", async ({ page }) => {
  await page.goto("/jogos/flip7");
  await page.evaluate(() => localStorage.setItem("croebet:demo-username", "Marco"));
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Modo Brutal" })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Versão do Flip7" }).selectOption("vengeance");
  await page.getByRole("combobox", { name: "Modo Brutal" }).selectOption("true");
  await page.getByRole("button", { name: "Regras", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Brutal");
  await expect(page.getByRole("dialog")).toContainText("A pontuação pode ser negativa");
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "Versão do Flip7" }).selectOption("classic");
  await expect(page.getByRole("combobox", { name: "Modo Brutal" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("combobox", { name: "Versão do Flip7" }).selectOption("vengeance");
  await page.getByRole("combobox", { name: "Modo Brutal" }).selectOption("true");
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
  await page.getByRole("button", { name: "Marco vai roubar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Selecionar 9 de Pessoa", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Selecionar 9 de Pessoa", exact: true }).click();
  expect((await savedGame(page)).players[1].cards).toHaveLength(1);
  await expect(page.locator("[data-moving-card]")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirmar", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Selecionar 9 de Pessoa", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
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

test("Trocar seleciona duas cartas de mãos diferentes com teclado e move ambas", async ({ page }) => {
  const game = transition(transition(scenario([["swap"]], { mode: "vengeance", brutal: false }), { type: "draw" }), { type: "target", target: 0 });
  await restore(page, game);
  const confirm = page.getByRole("button", { name: "Confirmar", exact: true });
  await expect(confirm).toBeDisabled();
  const before = await savedGame(page);
  const first = page.getByRole("button", { name: "Selecionar 8 de Marco", exact: true });
  await first.focus(); await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Selecionar 9 de Pessoa", exact: true }).click();
  await expect(confirm).toBeEnabled();
  await expect(page.locator("[data-moving-card]")).toHaveCount(0);
  expect(await savedGame(page)).toEqual(before);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(confirm).toBeDisabled();
  await expect(first).toHaveAttribute("aria-pressed", "false");
  expect(await savedGame(page)).toEqual(before);
  await first.click();
  await page.getByRole("button", { name: "Selecionar 9 de Pessoa", exact: true }).click();
  // Deselecting a card invalidates the pair without committing the exchange.
  await first.click();
  await expect(confirm).toBeDisabled();
  await first.click();
  await confirm.click();
  await expect(page.locator("[data-moving-card]")).toHaveCount(2);
  await expect(page.locator("[data-moving-card]")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Mesa de Marco", exact: true }).getByRole("img", { name: "9", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Mesa de Pessoa", exact: true }).getByRole("img", { name: "8", exact: true })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Próxima rodada", exact: true })).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Parar", exact: true })).toBeDisabled();
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

test("Descartar confirma a carta ruim da própria mão e Cancelar preserva todas as cartas", async ({ page }) => {
  let game = scenario([["remove"]], { mode: "vengeance", brutal: false });
  const index = game.deck.findIndex(c => c.type === "minus" && c.value === 10);
  const bad = game.deck.splice(index, 1)[0];
  game.players[0].cards.push(bad);
  game.players[1].kind = "normal";
  game = transition(game, { type: "draw" });
  await restore(page, game);
  await page.getByRole("button", { name: "Marco escolhe a carta para descartar", exact: true }).click();
  const before = await savedGame(page);
  const choice = page.getByRole("button", { name: "Selecionar −10 de Marco", exact: true });
  await choice.click();
  expect(await savedGame(page)).toEqual(before);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(choice).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Confirmar", exact: true })).toBeDisabled();
  await choice.click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.locator("[data-moving-card]")).toHaveCount(1);
  // Persisting precedes animation and the bot's next action.
  const saved = await savedGame(page);
  expect(saved.discard.some(c => c.id === bad.id)).toBe(true);
  expect(saved.players[0].cards.some(c => c.id === bad.id)).toBe(false);
  await expect(page.locator("[data-moving-card]")).toHaveCount(0);
});
