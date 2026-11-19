import { expect, test } from "@playwright/test";
import { createGame } from "../../features/games/flip7/engine";

const user = { id: "93089d02-0b34-4b78-9d3e-f2679c190b5b", username: "Marco", displayName: "Marco", role: "user" };
const economy = { initialBalance: 30, dailyReward: 10, dailyResetTimeZone: 'America/Sao_Paulo', suggestedBets: [1, 5, 10, 50], defaultBet: 5 };
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { user } }));
  await page.route("**/api/v1/economy", route => route.fulfill({ json: economy }));
  await page.route("**/api/v1/rewards/daily", route => route.fulfill({ json: {
    balance: 30, eligible: true, lastClaimAt: null, nextClaimAt: null, serverNow: new Date().toISOString(),
  } }));
});

test("entrada com Croins permanece bloqueada e não movimenta carteira local", async ({ page }) => {
  await page.goto("/jogos/flip7");
  await expect(page.getByRole("button", { name: "Conta de Marco" }).first()).toBeVisible();
  await page.getByRole("switch", { name: "Jogar com Croins", exact: true }).check();
  const entry = page.getByRole("spinbutton", { name: "Entrada por jogador" });
  await expect(entry).toHaveValue("5");
  await page.getByRole("combobox", { name: "Número de jogadores" }).selectOption("4");
  await expect(page.getByText("20 Croins", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pagar 5 Croins e jogar" })).toBeDisabled();
  await expect(page.getByText("Partidas com Croins ainda não estão disponíveis.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("croebet:demo-wallet:marco"))).toBeNull();
  await entry.fill("0");
  await expect(page.getByRole("alert")).toContainText("inteira maior que zero");
  await entry.fill("50");
  await expect(page.getByRole("alert")).toContainText("Saldo insuficiente");
  await page.getByRole("switch", { name: "Jogar com Croins", exact: true }).uncheck();
  await expect(page.getByRole("button", { name: "Começar partida", exact: true })).toBeVisible();
});

test("retomada de partida econômica do protótipo não credita nem debita a carteira", async ({ page }) => {
  const match = { version: 1, code: "ABCDEF123456", wager: { username: "Marco", stake: 5 }, game: createGame([
    { name: "Marco", kind: "human" }, { name: "Bot", kind: "normal" },
  ], 42) };
  await page.addInitScript(saved => {
    localStorage.setItem("croebet:flip7:match", JSON.stringify(saved));
    localStorage.setItem("croebet:demo-wallet:marco", JSON.stringify({ balance: 999, transactions: [], predictions: [], lastClaim: "" }));
  }, match);
  await page.goto("/jogos/flip7?partida=ABCDEF123456");
  await expect(page.getByRole("alert")).toContainText("Partidas com Croins ainda não estão disponíveis.");
  await expect(page.getByRole("region", { name: "Mesa de Flip7" })).toHaveCount(0);
  const wallet = await page.evaluate(() => JSON.parse(localStorage.getItem("croebet:demo-wallet:marco")!));
  expect(wallet.balance).toBe(999); expect(wallet.transactions).toEqual([]);
});
