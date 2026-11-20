import { test, expect } from "@playwright/test";
import { matchSchema } from "@croebet/shared";
import { createGame } from "../../../api/src/modules/games/flip7/engine";
import { flip7Driver } from "../../../api/src/modules/games/flip7/driver";
import { startPublicApi } from "../public-api-fixture";
import { matchesFixture, fixtureUser, matchUsers } from "../matches-api-fixture";

// Run against the development webServer from playwright.config.ts.
test("painel dev testa arquivos e salva um único som de compra", async ({ page, context }) => {
  const fixture = matchesFixture();
  const close = await startPublicApi(fixtureUser, fixture.handler, fixture.attach);
  try {
    const code = "ABCDEF123456";
    const state = flip7Driver.project(createGame(matchUsers.map(user => ({ name: user.username, kind: "human" as const })), 42, { mode: "classic", brutal: false }));
    const room = matchSchema.parse({ id: "93089d02-0b34-4b78-9d3e-f2679c190b5e", code, game: "flip7", rulesVersion: 1, version: 1, status: "playing", state, hostId: matchUsers[0].id, capacity: 2, options: { mode: "classic", brutal: false }, participants: matchUsers.map((user, seat) => ({ userId: user.id, username: user.username, displayName: user.displayName, avatarUrl: null, seat })) });
    fixture.states.set(code, { room, frames: [] });
    await context.addCookies([{ name: "croebet-session", value: "game-fixture-marco", url: "http://127.0.0.1:3100" }]);
    await page.goto(`/jogos/flip7?partida=${code}`);
    await page.getByRole("button", { name: "Testar sons (dev)", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "Áudios · Desenvolvimento" });
    const search = panel.getByRole("searchbox", { name: "Buscar áudio" });
    await search.fill("card-slide-7");
    await expect(panel.getByRole("listitem")).toHaveCount(1);
    await panel.getByRole("button", { name: "Ouvir card-slide-7", exact: true }).click();
    await expect(panel.getByRole("status")).toHaveText("Último teste: card-slide-7");
    await panel.getByRole("button", { name: "Usar card-slide-7 ao puxar carta", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Usar card-slide-7 ao puxar carta", exact: true })).toHaveAttribute("aria-pressed", "true");
    await search.fill("dice-shake-1");
    await panel.getByLabel("Ouvir arquivo original (com silêncios)").check();
    await panel.getByRole("button", { name: "Ouvir dice-shake-1", exact: true }).click();
    await expect(panel.getByRole("status")).toHaveText("Último teste: dice-shake-1");
    await panel.getByRole("button", { name: "Parar", exact: true }).click();
    await panel.getByRole("button", { name: "Fechar", exact: true }).click();
    await page.reload();
    await page.getByRole("button", { name: "Testar sons (dev)", exact: true }).click();
    await expect(panel.getByText("card-slide-7", { exact: true }).first()).toBeVisible();
    await panel.getByRole("button", { name: "Restaurar padrão", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Usar card-slide-1 ao puxar carta", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(fixture.states.get(code)?.room.version).toBe(1);
  } finally { await context.close(); await close(); }
});
