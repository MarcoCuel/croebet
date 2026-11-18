import { expect, test, type Page } from "@playwright/test";
import type { Game } from "../../features/games/flip7/types";

async function wallet(page: Page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("croebet:demo-wallet:marco")!));
}

async function setup(page: Page) {
  await page.goto("/jogos/flip7");
  await page.evaluate(() => {
    localStorage.setItem("croebet:demo-username", "Marco");
    localStorage.setItem("croebet:demo-wallet:marco", JSON.stringify({ balance: 1067, lastClaim: "", transactions: [], predictions: [] }));
  });
  await page.reload();
  await page.getByRole("switch", { name: "Jogar com Croins", exact: true }).check();
}

test("entrada atualiza o pote, usa bots e reload não cobra novamente", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await setup(page);
  await page.getByRole("combobox", { name: "Número de jogadores" }).selectOption("4");
  await expect(page.getByRole("button", { name: /^Editar Bot / })).toHaveCount(3);
  const entry = page.getByRole("spinbutton", { name: "Entrada por jogador" });
  await entry.fill("0");
  await expect(page.getByRole("alert")).toContainText("inteira maior que zero");
  await entry.fill("1068");
  await expect(page.getByRole("alert")).toContainText("Saldo insuficiente");
  await expect(page.getByRole("button", { name: "Pagar 1.068 Croins e jogar" })).toBeDisabled();
  await entry.fill("50");
  await expect(page.getByText("200 Croins", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Editar Bot 1", exact: true }).click();
  await expect(page.getByRole("dialog").getByLabel("Tipo", { exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Pagar 50 Croins e jogar", exact: true }).click();
  const board = page.getByRole("region", { name: "Mesa de Flip7", exact: true });
  await expect(board).toBeVisible();
  await expect(board.getByText("200 Croins", { exact: true })).toBeVisible();
  expect((await wallet(page)).balance).toBe(1017);
  const code = new URL(page.url()).searchParams.get("partida")!;
  await page.reload();
  await expect(board).toBeVisible();
  await page.goto("/jogos");
  await page.goto("/jogos/flip7");
  await expect(page.getByRole("heading", { name: "Partidas em andamento", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Continuar partida", exact: true }).click();
  await expect(board).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`partida=${code}`));
  expect((await wallet(page)).transactions.map((tx: { amount: number }) => tx.amount)).toEqual([-50]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Abandonar partida", exact: true }).click();
  const abandon = page.getByRole("dialog", { name: "Abandonar partida?", exact: true });
  await expect(abandon).toContainText("50 Croins não será devolvida");
  await abandon.getByRole("button", { name: "Continuar jogando", exact: true }).click();
  expect((await wallet(page)).balance).toBe(1017);
  await page.getByRole("button", { name: "Abandonar partida", exact: true }).click();
  await abandon.getByRole("button", { name: "Abandonar partida", exact: true }).click();
  await expect(page).toHaveURL(/\/jogos\/flip7$/);
  await expect(page.getByRole("combobox", { name: "Número de jogadores", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("croebet:flip7:match"))).toBeNull();
  expect((await wallet(page)).balance).toBe(1017);
  expect(errors).toEqual([]);
});

for (const outcome of ["vitória", "empate", "derrota"] as const) {
  test(`${outcome} resolve os Croins no resultado sem repetir o pagamento`, async ({ page }) => {
    await setup(page);
    await page.getByRole("button", { name: "Pagar 50 Croins e jogar", exact: true }).click();
    await expect(page.getByRole("region", { name: "Mesa de Flip7", exact: true })).toBeVisible();
    // Keep the actual debited entry and deck, preparing the final human decision.
    await page.evaluate(outcome => {
      const saved = JSON.parse(localStorage.getItem("croebet:flip7:match")!);
      const game = (saved.version === 2 ? saved.matches.find((match: { code: string }) => match.code === new URLSearchParams(location.search).get("partida")) : saved).game as Game;
      game.deck.push(...game.discard, ...game.players.flatMap(p => p.cards), ...game.queue.map(p => p.card), ...(game.pending ? [game.pending.card] : []));
      game.discard = []; game.queue = []; game.pending = null; game.forced = null;
      game.turn = 0; game.phase = "playing"; game.flip7 = null; game.history = []; game.lastDraw = null;
      game.players.forEach((player, i) => {
        const card = game.deck.findIndex(card => card.type === "number" && card.value === 8 + i);
        player.cards = [game.deck.splice(card, 1)[0]];
        player.hasDrawn = true;
        player.status = i === 0 ? "playing" : "stayed";
        player.total = i === 0 ? 199 : outcome === "vitória" ? 100 : outcome === "empate" ? 198 : 220;
      });
      localStorage.setItem("croebet:flip7:match", JSON.stringify(saved));
    }, outcome);
    await page.reload();
    await page.getByRole("button", { name: "Parar", exact: true }).click();
    const result = page.getByRole("dialog", { name: "Resultado da partida", exact: true });
    await expect(result).toBeVisible();
    const expectedPrize = outcome === "vitória" ? 100 : outcome === "empate" ? 50 : 0;
    const expectedBalance = 1017 + expectedPrize;
    await expect(result.getByLabel("Resultado em Croins")).toContainText(`${expectedPrize} Croins`);
    await expect(result.getByRole("button", { name: "Jogar novamente", exact: true })).toBeEnabled();
    expect((await wallet(page)).balance).toBe(expectedBalance);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Ver resultado", exact: true }).click();
    expect((await wallet(page)).balance).toBe(expectedBalance);
    await page.reload();
    await expect(result).toBeVisible();
    expect((await wallet(page)).balance).toBe(expectedBalance);
    const transactions = (await wallet(page)).transactions;
    expect(transactions.map((tx: { amount: number }) => tx.amount)).toEqual(expectedPrize ? [expectedPrize, -50] : [-50]);
    const finishedUrl = page.url();
    const finishedSnapshot = await page.evaluate(() => localStorage.getItem("croebet:flip7:match"));
    await result.getByRole("button", { name: "Jogar novamente", exact: true }).click();
    await expect(page.getByRole("button", { name: "Começar partida", exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("croebet:flip7:match"))).toBe(finishedSnapshot);
    await expect(page.getByRole("complementary", { name: "Partidas em andamento" })).toHaveCount(0);
    await page.goto(finishedUrl);
    await expect(result).toBeVisible();
    expect((await wallet(page)).balance).toBe(expectedBalance);
    expect((await wallet(page)).transactions).toEqual(transactions);
    await page.goto("/historico");
    await expect(page.getByText(/Flip7 · Entrada/)).toBeVisible();
    if (expectedPrize) await expect(page.getByText(/Flip7 · Prêmio/)).toBeVisible();
  });
}
