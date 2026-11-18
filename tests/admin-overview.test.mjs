import assert from "node:assert/strict";
import { test } from "node:test";
import { buildOverview } from "../features/admin/overview-data.ts";

const now = new Date("2026-11-18T02:00:00Z"); // Ainda dia 17 no Brasil.
const wallet = {
  balance: 900, lastClaim: "", predictions: [
    { id: "one", marketId: "live", market: "Live?", outcome: "Sim", stake: 100, createdAt: "2026-11-18T01:00:00Z" },
    { id: "old", marketId: "live", market: "Live?", outcome: "Sim", stake: 50, createdAt: "2026-11-16T22:00:00Z" },
    { market: "Live?", outcome: "Sim", stake: 70 },
  ],
  transactions: [
    { id: "bonus", description: "Bônus diário", amount: 67, createdAt: "2026-11-18T01:00:00Z", balance: 900 },
    { id: "future", description: "Bônus diário", amount: 67, createdAt: "2026-11-18T04:00:00Z", balance: 967 },
  ],
};
const market = { id: "live", question: "Live?", type: "binary", options: ["Sim", "Não"], criterion: "", status: "open", endsAt: null };

test("resumo respeita o dia brasileiro, o período e a ausência de datas antigas", () => {
  const data = buildOverview([{ username: "ana", wallet }], [market], 1, now);
  assert.equal(data.volume, 100);
  assert.equal(data.predictionCount, 1);
  assert.equal(data.active, 1);
  assert.equal(data.bonus, 67);
  assert.equal(data.balance, 900);
  assert.equal(data.transactions.length, 1);
  assert.deepEqual(data.buckets, [{ day: "2026-11-17", count: 1, total: 100 }]);
  const week = buildOverview([{ username: "ana", wallet }], [market], 7, now);
  assert.equal(week.volume, 150);
  assert.equal(week.topMarkets[0].participants, 1);
  assert.equal(week.buckets.length, 7);
});

test("pendências independem do período e priorizam pagamentos", () => {
  const data = buildOverview([], [
    { ...market, id: "expired", endsAt: "2026-11-16T22:00:00Z" },
    { ...market, id: "closed", status: "closed" },
    { ...market, id: "resolved", status: "resolved" },
    { ...market, id: "paid", status: "paid" },
    market,
  ], 1, now);
  assert.deepEqual(data.pending.map((entry) => entry.market.id), ["resolved", "closed", "expired"]);
  assert.equal(data.predictionCount, 0);
  assert.equal(data.balance, 0);
});
