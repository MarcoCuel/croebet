import { test, expect, type Page } from "@playwright/test";
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
    await openAudioPanel(page);
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
    await openAudioPanel(page);
    await expect(panel.getByText("card-slide-7", { exact: true }).first()).toBeVisible();
    await panel.getByRole("button", { name: "Restaurar padrão", exact: true }).click();
    await expect(panel.getByRole("button", { name: "Usar card-slide-1 ao puxar carta", exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(fixture.states.get(code)?.room.version).toBe(1);
  } finally { await context.close(); await close(); }
});

// Count actual notification source starts, using the real asset and decoder.
test("aviso de turno toca uma vez e não repete ao reconectar", async ({ page, context }) => {
  const fixture = matchesFixture();
  const close = await startPublicApi(fixtureUser, fixture.handler, fixture.attach);
  try {
    await recordNotifications(page);
    const code = "ABCDEF123456";
    const state = flip7Driver.project(createGame(matchUsers.map(user => ({ name: user.username, kind: "human" as const })), 42, { mode: "classic", brutal: false }));
    state.turn = 1;
    state.players.forEach((player, seat) => { player.hasDrawn = true; player.cards = [{ id: seat + 1, type: "number", value: seat + 2 }]; });
    const room = matchSchema.parse({ id: "93089d02-0b34-4b78-9d3e-f2679c190b5e", code, game: "flip7", rulesVersion: 1, version: 1, status: "playing", state, hostId: matchUsers[0].id, capacity: 2, options: { mode: "classic", brutal: false }, participants: matchUsers.map((user, seat) => ({ userId: user.id, username: user.username, displayName: user.displayName, avatarUrl: null, seat })) });
    fixture.states.set(code, { room, frames: [] });
    await context.addCookies([{ name: "croebet-session", value: "game-fixture-marco", url: "http://127.0.0.1:3100" }]);
    await page.goto(`/jogos/flip7?partida=${code}`);
    const decoded = page.waitForResponse(response => response.url().endsWith("/audio/notification.mp3"));
    await page.getByRole("region", {name:"Mesa de Flip7",exact:true}).click({position:{x:5,y:5}});
    await decoded;
    await page.keyboard.press("Escape");
    await expect(page.locator("html")).toHaveAttribute("data-notification-ready", "3");
    room.state.turn = 0; room.version++;
    fixture.disconnectUser(matchUsers[0].id);
    await expect(page.locator("html")).toHaveAttribute("data-notification-plays", "1");
    const reconnected = page.waitForEvent("websocket").then(socket => socket.waitForEvent("framereceived", { predicate: event => String(event.payload).includes('"invitations"') }));
    fixture.disconnectUser(matchUsers[0].id);
    await reconnected;
    await expect(page.getByText("Reconectando à partida…")).toHaveCount(0);
    await page.getByRole("region", {name:"Mesa de Flip7",exact:true}).click({position:{x:5,y:5}});
    await page.keyboard.press("Escape");
    await expect(page.locator("html")).toHaveAttribute("data-notification-plays", "1");
  } finally { await context.close(); await close(); }
});

async function openAudioPanel(page: Page) {
  await page.getByRole("button", { name: "Opções da partida", exact: true }).click();
  await page.getByRole("button", { name: "Testar sons (dev)", exact: true }).click();
}

async function recordNotifications(page: Page) {
    await page.addInitScript(() => {
      const data = new WeakSet<ArrayBuffer>();
      const buffers = new WeakSet<AudioBuffer>();
      const originalFetch = window.fetch;
      window.fetch = async (...args) => {
        const response = await originalFetch(...args);
        if (String(args[0]).endsWith("/audio/notification.mp3")) {
          const read = response.arrayBuffer.bind(response);
          response.arrayBuffer = async () => { const bytes = await read(); data.add(bytes); return bytes; };
        }
        return response;
      };
      const decode = AudioContext.prototype.decodeAudioData;
      AudioContext.prototype.decodeAudioData = async function (bytes) {
        const buffer = await decode.call(this, bytes);
        if (data.has(bytes)) { buffers.add(buffer); document.documentElement.dataset.notificationReady = String(Number(document.documentElement.dataset.notificationReady ?? 0) + 1); }
        return buffer;
      };
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        if (this.buffer && buffers.has(this.buffer)) document.documentElement.dataset.notificationPlays = String(Number(document.documentElement.dataset.notificationPlays ?? 0) + 1);
        return start.apply(this, args);
      };
    });
}

test("novo alerta de convite toca uma vez mesmo com atualizações da sala", async ({ page, context, browser }) => {
  const fixture = matchesFixture();
  const close = await startPublicApi(fixtureUser, fixture.handler, fixture.attach);
  const peer = await browser.newContext();
  try {
    await context.addCookies([{ name: "croebet-session", value: "game-fixture-marco", url: "http://127.0.0.1:3100" }]);
    await peer.addCookies([{ name: "croebet-session", value: "game-fixture-beto", url: "http://127.0.0.1:3100" }]);
    await recordNotifications(page);
    await page.goto("/jogos/flip7");
    await page.getByLabel("Número de jogadores").selectOption("6");
    await expect(page.locator("html")).toHaveAttribute("data-notification-ready", "2");
    const host = await peer.newPage();
    await host.goto("/jogos/flip7");
    await host.getByRole("button", { name: "Jogar", exact: true }).click();
    await host.getByRole("button", { name: "Convidar jogadores", exact: true }).click();
    await host.getByRole("button", { name: "Convidar Marco", exact: true }).click();
    await host.keyboard.press("Escape");
    await expect(page.getByRole("alert").filter({ hasText: "Beto convidou" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-notification-plays", "1");
    // Reconnecting re-emits the inbox with the same invitation.
    const reconnected = page.waitForEvent("websocket").then(socket => socket.waitForEvent("framereceived", { predicate: event => String(event.payload).includes('"invitations"') }));
    fixture.disconnectUser(matchUsers[0].id);
    await reconnected;
    await page.getByRole("alert").filter({ hasText: "Beto convidou" }).getByRole("button", { name: "Recusar", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Beto convidou" })).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("data-notification-plays", "1");
  } finally { await peer.close(); await context.close(); await close(); }
});
