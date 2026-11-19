import assert from "node:assert/strict";
import { test } from "node:test";
import {
  acceptsPredictions,
  isSettlement,
  makeSettlement,
  transitionMarket,
  validOutcome,
} from "../features/betting/settlement.ts";

const market = {
  id: "event",
  question: "Vai ter live?",
  criterion: "O início da transmissão.",
  type: "binary",
  options: ["Sim", "Não"],
  status: "closed",
  endsAt: null,
};
const date = "2026-11-18T12:00:00.000Z";
const entry = (id, username, outcome, stake) => ({
  id,
  username,
  marketId: "event",
  market: market.question,
  outcome,
  stake,
  createdAt: date,
  status: "pending",
});
const plan = (entries) => makeSettlement(market, entries, "Sim", "plan", date);

test("rateio distribui todo o montante proporcionalmente, incluindo a aposta inicial", () => {
  const entries = [
    entry("a", "Ana", "Sim", 50),
    entry("b", "Beto", "Sim", 200),
    entry("c", "Caio", "Não", 750),
  ];
  const result = plan(entries);
  assert.equal(result.total, 1000);
  assert.deepEqual(
    result.allocations.map((a) => a.amount),
    [200, 800, 0],
  );
  assert.equal(isSettlement(result), true);
  assert.equal(entries[0].status, "pending");
});

test("sobras inteiras têm desempate determinístico por ID, independentemente da ordem", () => {
  const entries = [
    entry("b", "B", "Sim", 1),
    entry("a", "A", "Sim", 1),
    entry("c", "C", "Não", 1),
  ];
  const shares = Object.fromEntries(
    plan(entries).allocations.map((a) => [a.predictionId, a.amount]),
  );
  assert.deepEqual(shares, { b: 1, a: 2, c: 0 });
  assert.deepEqual(
    Object.fromEntries(
      plan([...entries].reverse()).allocations.map((a) => [
        a.predictionId,
        a.amount,
      ]),
    ),
    shares,
  );
});

test("cálculo com inteiros grandes não perde precisão por multiplicação", () => {
  const half = Math.floor(Number.MAX_SAFE_INTEGER / 2);
  const entries = [
    entry("a", "A", "Sim", half),
    entry("b", "B", "Sim", 1),
    entry("c", "C", "Não", half),
  ];
  const result = plan(entries);
  assert.equal(result.total, Number.MAX_SAFE_INTEGER);
  assert.equal(
    result.allocations.reduce((sum, a) => sum + BigInt(a.amount), 0n),
    BigInt(Number.MAX_SAFE_INTEGER),
  );
});

test("sem vencedores e cancelamento devolvem exatamente os valores originais", () => {
  const entries = [entry("a", "A", "Não", 23), entry("b", "B", "Não", 7)];
  const noWinners = plan(entries);
  assert.equal(noWinners.kind, "refund");
  assert.equal(noWinners.result, "Sim");
  assert.deepEqual(
    noWinners.allocations.map((a) => a.amount),
    [23, 7],
  );
  const cancelled = makeSettlement(
    { ...market, status: "open" },
    entries,
    null,
    "cancel",
    date,
    true,
  );
  assert.equal(cancelled.result, null);
  assert.deepEqual(
    cancelled.allocations.map((a) => a.amount),
    [23, 7],
  );
});

test("aposta numérica exige inteiro exato e aceita zero sem aproximação", () => {
  const numeric = { ...market, type: "number", unit: "minutos" };
  for (const outcome of ["0 minutos", "23 minutos"])
    assert.equal(validOutcome(numeric, outcome), true);
  for (const outcome of [
    "1.5 minutos",
    "-1 minutos",
    "01 minutos",
    "0",
    "23 horas",
    "Infinity minutos",
  ])
    assert.equal(validOutcome(numeric, outcome), false);
  const entries = [entry("a", "A", "23 minutos", 10)];
  assert.equal(
    makeSettlement(numeric, entries, "24 minutos", "num", date).kind,
    "refund",
  );
});

test("status bloqueia apostas fora do período e não reabre finalizadas", () => {
  assert.equal(acceptsPredictions({ ...market, status: "open" }, 10), true);
  for (const status of [
    "draft",
    "paused",
    "closed",
    "resolved",
    "paid",
    "cancelled",
  ])
    assert.equal(acceptsPredictions({ ...market, status }, 10), false);
  assert.equal(
    acceptsPredictions(
      { ...market, status: "open", endsAt: "1970-01-01T00:00:00.010Z" },
      10,
    ),
    false,
  );
  assert.equal(
    transitionMarket({ ...market, status: "draft" }, "open").status,
    "open",
  );
  assert.equal(
    transitionMarket({ ...market, status: "paused" }, "closed").status,
    "closed",
  );
  assert.throws(() => transitionMarket(market, "open"));
  assert.throws(() => transitionMarket({ ...market, status: "paid" }, "open"));
  assert.throws(() =>
    transitionMarket(
      { ...market, status: "draft", endsAt: "1970-01-01T00:00:00.000Z" },
      "open",
    ),
  );
});

test("apuração rejeita duplicatas, montante inseguro, resultado inválido e segunda apuração", () => {
  const e = entry("a", "Ana", "Sim", 1);
  assert.throws(() => plan([e, e]), /inconsistentes/);
  assert.throws(() => plan([{ ...e, marketId: "outro" }]), /inconsistentes/);
  assert.throws(
    () =>
      plan([
        { ...e, stake: Number.MAX_SAFE_INTEGER },
        { ...e, id: "b" },
      ]),
    /limite/,
  );
  assert.throws(
    () => makeSettlement(market, [e], "Talvez", "x", date),
    /válido/,
  );
  assert.throws(
    () => makeSettlement({ ...market, status: "open" }, [e], "Sim", "x", date),
    /Encerre/,
  );
  assert.throws(() =>
    makeSettlement(
      { ...market, settlement: plan([e]), status: "resolved" },
      [e],
      "Sim",
      "x",
      date,
    ),
  );
  assert.equal(isSettlement({ ...plan([e]), total: 999 }), false);
});

test("rateios aleatórios conservam o total e nunca alteram os palpites", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const entries = Array.from({ length: 12 }, (_, i) =>
      entry(
        String(i).padStart(2, "0"),
        `User${i % 4}`,
        (i + seed) % 3 === 0 ? "Sim" : "Não",
        1 + ((seed * (i + 7)) % 997),
      ),
    );
    const original = JSON.stringify(entries);
    const result = plan(entries);
    assert.equal(
      result.allocations.reduce((sum, a) => sum + a.amount, 0),
      result.total,
    );
    assert.equal(
      result.allocations.every(
        (a) => Number.isSafeInteger(a.amount) && a.amount >= 0,
      ),
      true,
    );
    assert.equal(JSON.stringify(entries), original);
  }
});
