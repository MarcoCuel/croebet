import { test } from "node:test";
import assert from "node:assert/strict";
import { gameDefinitions, maxGamePlayers, gameOptionsForPlayers } from "../dist/index.js";

test("quantidade usa todos os modos e mantém a configuração compatível atual",()=>{
  const definition=gameDefinitions["love-letter"];
  const classic={mode:"classic",brutal:false},modern={mode:"modern",brutal:false};
  assert.equal(maxGamePlayers(definition,classic),6);
  assert.deepEqual(gameOptionsForPlayers(definition,classic,6),modern);
  assert.deepEqual(gameOptionsForPlayers(definition,classic,4),classic);
  assert.deepEqual(gameOptionsForPlayers(definition,modern,2),modern);
  assert.throws(()=>gameOptionsForPlayers(definition,classic,7));
  assert.throws(()=>gameOptionsForPlayers(definition,classic,1));
});

test("jogos de limite fixo preservam modo e opções ao ajustar jogadores",()=>{
  const definition=gameDefinitions.flip7,options={mode:"vengeance",brutal:true};
  assert.equal(maxGamePlayers(definition,options),12);
  assert.deepEqual(gameOptionsForPlayers(definition,options,2),options);
  assert.deepEqual(gameOptionsForPlayers(definition,options,12),options);
});
