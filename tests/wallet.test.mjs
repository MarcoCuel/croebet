import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addCroins,
  claimReward,
  dailyReward,
  initialWallet,
  isPrediction,
  registerPrediction,
} from "../features/wallet/wallet.ts";

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

test("bônus só pode ser resgatado uma vez por dia e libera no dia seguinte", () => {
  const first = claimReward(initialWallet, "17/11/2026");
  assert.equal(first.balance, initialWallet.balance + dailyReward);
  assert.equal(claimReward(first, "17/11/2026"), first);
  assert.equal(
    claimReward(first, "18/11/2026").balance,
    first.balance + dailyReward,
  );
});

test("recarga de teste respeita limites e rejeita overflow", () => {
  assert.equal(addCroins(initialWallet, 1).balance, 1068);
  for (const value of [0, -1, 0.5, 1000000, NaN])
    assert.equal(addCroins(initialWallet, value), initialWallet);
  const full = { ...initialWallet, balance: Number.MAX_SAFE_INTEGER };
  assert.equal(addCroins(full, 1), full);
  assert.equal(claimReward(full, "17/11/2026"), full);
});
