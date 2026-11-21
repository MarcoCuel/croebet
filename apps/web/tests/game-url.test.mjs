import assert from "node:assert/strict";
import { test } from "node:test";
import { gameUrl } from "../features/games/game-url.ts";

test("links e retorno usam o slug de qualquer jogo", () => {
  for (const slug of ["flip7", "love-letter", "outro-jogo"]) {
    const link = new URL(gameUrl(slug, {code:"ABCDEF123456", development:true, invite:true}), "https://croebet.test");
    assert.equal(link.pathname, `/jogos/${slug}`);
    assert.equal(link.searchParams.get("partida"), "ABCDEF123456");
    assert.equal(link.searchParams.get("convidar"), "1");
    const back = new URL(gameUrl(slug, {development:true}), link);
    assert.equal(back.pathname, link.pathname);
    assert.equal(back.searchParams.get("teste"), "1");
    assert.equal(back.searchParams.has("partida"), false);
  }
});
test("convite compartilhado leva à partida sem exigir ferramenta administrativa", () => {
  const link = new URL(gameUrl("outro-jogo", {code:"ABCDEF123456"}), "https://croebet.test");
  assert.equal(link.searchParams.get("partida"), "ABCDEF123456");
  assert.equal(link.searchParams.has("teste"), false);
  assert.equal(link.searchParams.has("convidar"), false);
});
