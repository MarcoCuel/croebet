import { test } from "node:test";
import assert from "node:assert/strict";
import { standardDecision, standardLogLength } from "../features/games/standard-decision.ts";

test("decisão padrão pertence à vaga com ações legais", () => {
  assert.deepEqual(standardDecision({ phase: "playing", round: 2, turn: 1, log: [1, 2, 3], legalActions: [{ type: "draw" }] }), { seat: 1, key: "2:1:3:1" });
  assert.equal(standardDecision({ phase: "summary", round: 2, turn: 1, legalActions: [{}] }), null);
  assert.equal(standardDecision({ phase: "playing", round: 2, turn: 1, legalActions: [] }), null);
  assert.equal(standardDecision({ phase: "playing", round: 2, legalActions: [{}] }), null);
  assert.equal(standardDecision(null), null);
});

test("inspeção privada usa quem está decidindo, não o turno", () => {
  assert.deepEqual(standardDecision({ phase: "playing", round: 3, turn: 2, log: [], legalActions: [{ type: "continue" }], inspection: { controller: 0 } }), { seat: 0, key: "3:0:0:1" });
});

test("log público mede a chegada de novas jogadas", () => {
  assert.equal(standardLogLength({ log: [1, 2] }), 2);
  assert.equal(standardLogLength({}), 0);
  assert.equal(standardLogLength(null), 0);
});
