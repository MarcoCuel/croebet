import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import { defaultCardSound, gameAudioCatalog, isGameAudioFile } from "../features/games/game-audio-catalog.ts";

test("catálogo de teste inclui exatamente os efeitos enviados e nenhum caminho arbitrário", () => {
  const files = readdirSync(new URL("../public/audio/cards/Audio/", import.meta.url)).filter(name => name.endsWith(".ogg")).map(name => name.slice(0, -4)).sort();
  assert.deepEqual([...gameAudioCatalog].sort(), files);
  assert.equal(new Set(gameAudioCatalog).size, files.length);
  for (const value of ["../License.txt", "/audio/other.ogg", "card-slide-99", null, 123]) assert.equal(isGameAudioFile(value), false);
});

test("som padrão é um único arquivo conhecido, sem sorteio de variantes", () => {
  assert.equal(defaultCardSound, "card-slide-1");
  assert.equal(isGameAudioFile(defaultCardSound), true);
});
