import { test } from "node:test";
import assert from "node:assert/strict";
import { gameDefinitions, gameMedia, standardGameMedia } from "../dist/index.js";

test("todo jogo declara som de carta e de vez, ou um opt-out justificado", () => {
  for (const [slug, definition] of Object.entries(gameDefinitions)) {
    assert.equal(typeof definition.media.card, "boolean", `${slug}: card`);
    assert.equal(typeof definition.media.turn, "boolean", `${slug}: turn`);
    if (definition.media.card && definition.media.turn) {
      assert.equal(definition.media.reason, undefined, `${slug}: motivo só existe no opt-out`);
      continue;
    }
    assert.match(definition.media.reason ?? "", /^.{10,}$/, `${slug}: opt-out exige motivo`);
  }
});

test("jogo fora do registro usa o padrão de mídia", () => {
  assert.deepEqual(gameMedia("nao-registrado"), standardGameMedia);
  assert.deepEqual(gameMedia(null), standardGameMedia);
  assert.deepEqual(gameMedia(undefined), standardGameMedia);
  assert.equal(gameMedia("flip7").card, true);
  assert.equal(gameMedia("flip7").turn, true);
});
