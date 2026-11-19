import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addCroins,
  initialWallet as emptyWallet,
  isPrediction,
  registerPrediction,
} from "../features/wallet/wallet.ts";

const initialWallet = { ...emptyWallet, balance: 1067 }; // Isolated prototype fixture, not an economic default.
const prediction = { market: "Mercado", outcome: "Sim", stake: 100, odds: 180 };

test("registrar um palpite desconta o saldo e preserva o histórico sem mutar a carteira", () => {
  const wallet = registerPrediction(initialWallet, prediction);
  assert.equal(wallet.balance, 967);
  assert.deepEqual(wallet.predictions, [prediction]);
  assert.equal(initialWallet.balance, 1067);
  assert.equal(initialWallet.predictions.length, 0);
});

test("a carteira rejeita saldo insuficiente e valores inválidos", () => {
  for (const stake of [0, -1, 0.5, NaN, Infinity, 1068])
    assert.equal(
      registerPrediction(initialWallet, { ...prediction, stake }),
      initialWallet,
    );
  for (const odds of [0, -1, NaN, 1.5])
    assert.equal(
      registerPrediction(initialWallet, { ...prediction, odds }),
      initialWallet,
    );
  assert.equal(isPrediction(null), false);
  assert.equal(isPrediction({ ...prediction, market: null }), false);
});

test("palpites gerais dispensam odds e preservam carteiras antigas", () => {
  for (const outcome of ["Sim", "À noite", "0 minutos", "23 minutos"]) {
    const entry = { market: "Próxima live", outcome, stake: 10 };
    assert.equal(isPrediction(entry), true);
    const wallet = registerPrediction(initialWallet, entry);
    assert.equal(wallet.balance, 1057);
    assert.deepEqual(wallet.predictions[0], entry);
  }
  assert.equal(isPrediction(prediction), true);
});

test("recarga de teste respeita limites e rejeita overflow", () => {
  assert.equal(addCroins(initialWallet, 1).balance, 1068);
  for (const value of [0, -1, 0.5, 1000000, NaN])
    assert.equal(addCroins(initialWallet, value), initialWallet);
  const full = { ...initialWallet, balance: Number.MAX_SAFE_INTEGER };
  assert.equal(addCroins(full, 1), full);
});

test("histórico registra entradas e saídas com saldo, data e origem sem duplicar rejeições", () => {
  const added = addCroins(initialWallet, 100);
  const spent = registerPrediction(added, prediction);
  assert.equal(spent.transactions.length, 2);
  assert.deepEqual(spent.transactions.map(({ amount }) => amount), [-100, 100]);
  assert.deepEqual(spent.transactions.map(({ balance }) => balance), [1067, 1167]);
  assert.match(spent.transactions[0].description, /Mercado.*Sim/);
  assert.ok(spent.transactions.every(({ createdAt }) => Number.isFinite(Date.parse(createdAt))));
  assert.equal(new Set(spent.transactions.map(({ id }) => id)).size, 2);
  assert.equal(addCroins(spent, -1), spent);
  assert.equal(initialWallet.transactions.length, 0);
});
