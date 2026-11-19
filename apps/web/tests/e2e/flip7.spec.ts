import { test, expect } from "@playwright/test";
import { startPublicApi } from "../public-api-fixture";
import { matchesFixture } from "../matches-api-fixture";

const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Marco", displayName: "Marco", role: "user" };
let fixture: ReturnType<typeof matchesFixture>;
let close: (() => Promise<void>) | undefined;
test.beforeEach(async ({ context }) => {
  fixture = matchesFixture(); close = await startPublicApi(() => user, fixture.handler);
  await context.addCookies([{ name: "croebet-session", value: "game-fixture", url: "http://127.0.0.1:3100" }]);
});
test.afterEach(async () => { await close?.(); });

async function start(page: import("@playwright/test").Page) {
  await page.goto("/jogos/flip7");
  await page.getByRole("button", { name: "Adicionar jogador 2", exact: true }).click();
  await page.getByRole("textbox", { name: "Nome" }).fill("Beto");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.getByRole("button", { name: "Começar partida", exact: true }).click();
  await expect(page).toHaveURL(/partida=[A-F0-9]{12}/);
  await expect(page.getByRole("button", { name: "Comprar", exact: true })).toBeVisible();
}

test("cria na API, apresenta a jogada confirmada e retoma a mesma partida após reload", async ({ page }) => {
  await start(page);
  const url = page.url();
  await page.getByRole("button", { name: "Comprar", exact: true }).click();
  await expect.poll(() => fixture.commands.length).toBe(1);
  await expect(page.getByRole("button", { name: "Comprar", exact: true })).toBeVisible();
  const match = [...fixture.states.values()][0].match;
  await expect(page.locator('[data-player-hand="0"] [data-hand-card]')).toHaveCount(match.state.players[0].cards.length);
  expect(fixture.commands[0]).toMatchObject({ expectedVersion: 2, action: { type: "draw" } });
  expect(JSON.stringify(match)).not.toContain('"deck":');
  expect(JSON.stringify(match)).not.toContain('"seed":');
  expect(await page.evaluate(() => localStorage.getItem("croebet:flip7:match"))).toBeNull();
  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(page.locator('[data-player-hand="0"] [data-hand-card]')).toHaveCount(match.state.players[0].cards.length);
  expect(fixture.commands).toHaveLength(1);
  await page.goto("/jogos/flip7");
  await page.getByRole("button", { name: "Continuar partida", exact: true }).click();
  await expect(page).toHaveURL(url);
  await page.getByRole("button", { name: "Abandonar partida", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Abandonar partida", exact: true }).click();
  await expect(page).toHaveURL(/\/jogos\/flip7$/);
  await expect(page.getByRole("button", { name: "Continuar partida" })).toHaveCount(0);
});

test("resposta perdida após confirmação permite repetir o mesmo comando sem comprar duas vezes", async ({ page }) => {
  await start(page); fixture.failNextResponse();
  await page.getByRole("button", { name: "Comprar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Resposta indisponível");
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByRole("button", { name: "Comprar", exact: true })).toBeVisible();
  expect(fixture.commands).toHaveLength(2);
  expect(fixture.commands[0]).toEqual(fixture.commands[1]);
  expect([...fixture.states.values()][0].match.state.players[0].cards).toHaveLength(2);
});

test("configuração econômica permanece bloqueada sem criar partidas ou carteiras locais", async ({ page }) => {
  await page.goto("/jogos/flip7");
  await page.getByRole("switch", { name: "Jogar com Croins", exact: true }).check();
  await expect(page.getByRole("button", { name: "Pagar 5 Croins e jogar" })).toBeDisabled();
  expect(fixture.states.size).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("croebet:demo-wallet:marco"))).toBeNull();
});
