import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(specifier.startsWith("@/") ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href : specifier, context);
} });
const { createGame, automaticAction, botAction, transition } = await import("../features/games/flip7/engine.ts");
const { decodeMatch, readMatch, saveMatch, matchStorageKey } = await import("../features/games/flip7/match-storage.ts");
const { wagerPayouts } = await import("../features/games/flip7/wager.ts");
const { startLocalMatch, prepareWagerMatch, saveWagerProgress, leaveLocalMatch } = await import("../features/games/flip7/wager-storage.ts");
const { initialWallet } = await import("../features/wallet/wallet.ts");
const { readWalletStrict, writeWalletStrict } = await import("../features/auth/session-storage.ts");

class Storage {
  data = new Map();
  fail = null;
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) {
    if (this.fail?.(key, value)) throw new Error("quota simulada");
    this.data.set(key, String(value));
  }
  removeItem(key) {
    if (this.fail?.(key)) throw new Error("quota simulada");
    this.data.delete(key);
  }
}
let storage;
const code = "ABCDEF123456";
function snapshot(stake = 50, count = 4, options = {}) {
  return { version: 1, code, wager: { username: "Marco", stake }, game: createGame([
    { name: "Marco", kind: "human" }, ...Array.from({ length: count - 1 }, (_, i) => ({ name: `Bot ${i + 1}`, kind: "normal" })),
  ], 42, options) };
}
function finished(game, totals) {
  let next = structuredClone(game);
  for (let i = 0; i < 5000 && next.phase !== "over"; i++)
    next = transition(next, next.phase === "summary" ? { type: "next" } : automaticAction(next) ?? botAction(next));
  assert.equal(next.phase, "over");
  if (totals) next.players.forEach((player, i) => { player.total = totals[i]; });
  return next;
}
beforeEach(() => {
  storage = new Storage();
  globalThis.localStorage = storage;
  const events = new EventTarget();
  events.localStorage = storage;
  globalThis.window = events;
  let chain = Promise.resolve();
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { locks: {
    request(_key, operation) {
      const next = chain.then(operation);
      chain = next.catch(() => {});
      return next;
    },
  } } });
  storage.setItem("croebet:demo-username", "Marco");
  writeWalletStrict("Marco", structuredClone(initialWallet));
});

test("entrada cobra apenas a pessoa, preserva carteira e retomadas não cobram novamente", async () => {
  const match = snapshot();
  await startLocalMatch(match);
  assert.equal(readWalletStrict("Marco").balance, 1017);
  assert.equal(readMatch().wager.stake * readMatch().game.players.length, 200);
  await Promise.all([prepareWagerMatch(code), prepareWagerMatch(code)]);
  assert.equal(readWalletStrict("Marco").transactions.length, 1);
  assert.deepEqual(readWalletStrict("Marco").predictions, []);
  await assert.rejects(startLocalMatch(match), /Já existe/);
});

test("todos os modos pagam o pote uma única vez e registram entrada e prêmio", async () => {
  for (const options of [{ mode: "classic" }, { mode: "vengeance" }, { mode: "vengeance", brutal: true }]) {
    writeWalletStrict("Marco", structuredClone(initialWallet));
    const match = snapshot(50, 4, options);
    await startLocalMatch(match);
    const over = finished(match.game, [250, 200, 150, 100]);
    await saveWagerProgress(code, match.game, over);
    assert.deepEqual(await Promise.all([prepareWagerMatch(code), prepareWagerMatch(code)]), [200, 200]);
    const wallet = readWalletStrict("Marco");
    assert.equal(wallet.balance, 1217);
    assert.deepEqual(wallet.transactions.map(tx => tx.amount), [200, -50]);
    assert.deepEqual(wallet.transactions.map(tx => tx.balance), [1217, 1017]);
    await leaveLocalMatch(code);
    assert.equal(readMatch(), null);
    assert.equal(readWalletStrict("Marco").balance, 1217);
  }
});

test("vitória de bot não credita a pessoa e empate divide inclusive com os bots", async () => {
  const match = snapshot();
  await startLocalMatch(match);
  await saveWagerProgress(code, match.game, finished(match.game, [150, 250, 250, 100]));
  assert.equal(await prepareWagerMatch(code), 0);
  assert.equal(readWalletStrict("Marco").balance, 1017);
  assert.equal(readWalletStrict("Marco").transactions.length, 1);
  await leaveLocalMatch(code);
  const next = { ...snapshot(), code: "123456ABCDEF" };
  await startLocalMatch(next);
  await saveWagerProgress(next.code, next.game, finished(next.game, [250, 250, 100, 50]));
  assert.equal(await prepareWagerMatch(next.code), 100);
  assert.equal(readWalletStrict("Marco").balance, 1067);
});

test("empates conservam o pote e as sobras inteiras seguem a ordem dos lugares", () => {
  const match = snapshot(1, 5);
  const game = finished(match.game, [200, 200, 200, 100, 50]);
  assert.deepEqual(wagerPayouts(game, 1), [2, 2, 1, 0, 0]);
  assert.throws(() => wagerPayouts(match.game, 1), /não terminou/);
});

test("valida entrada, saldo, pessoas extras, titular e overflow sem debitar", async () => {
  for (const stake of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    const match = snapshot(stake);
    assert.equal(decodeMatch(JSON.stringify(match), code), null);
    await assert.rejects(startLocalMatch(match));
  }
  await assert.rejects(startLocalMatch(snapshot(1068)), /Saldo insuficiente/);
  const humans = snapshot();
  humans.game.players[1].kind = "human";
  await assert.rejects(startLocalMatch(humans), /inválida/);
  storage.setItem("croebet:demo-username", "OutraConta");
  await assert.rejects(startLocalMatch(snapshot()), /conta/);
  assert.equal(readMatch(), null);
  assert.equal(readWalletStrict("Marco").balance, initialWallet.balance);
});

test("falha do snapshot não cobra; falha da carteira deixa uma entrada recuperável", async () => {
  const match = snapshot();
  storage.fail = key => key === matchStorageKey;
  await assert.rejects(startLocalMatch(match), /quota/);
  assert.equal(readMatch(), null);
  assert.equal(readWalletStrict("Marco").balance, initialWallet.balance);
  storage.fail = key => key.startsWith("croebet:demo-wallet:");
  await assert.rejects(startLocalMatch(match), /quota/);
  assert.deepEqual(readMatch(), match);
  assert.equal(readWalletStrict("Marco").balance, initialWallet.balance);
  await assert.rejects(saveWagerProgress(code, match.game, transition(match.game, { type: "draw" })), /ainda não foi paga/);
  storage.fail = null;
  await prepareWagerMatch(code);
  await prepareWagerMatch(code);
  assert.equal(readWalletStrict("Marco").balance, 1017);
  assert.equal(readWalletStrict("Marco").transactions.length, 1);
});

test("prêmio com falha pode ser retomado sem repetir crédito ou remover o resultado", async () => {
  const match = snapshot();
  await startLocalMatch(match);
  await saveWagerProgress(code, match.game, finished(match.game, [250, 100, 100, 100]));
  storage.fail = key => key.startsWith("croebet:demo-wallet:");
  await assert.rejects(prepareWagerMatch(code), /quota/);
  await assert.rejects(leaveLocalMatch(code), /quota/);
  assert.equal(readMatch().game.phase, "over");
  assert.equal(readWalletStrict("Marco").balance, 1017);
  storage.fail = null;
  assert.equal(await prepareWagerMatch(code), 200);
  storage.fail = key => key === matchStorageKey;
  await assert.rejects(leaveLocalMatch(code), /quota/);
  storage.fail = null;
  await leaveLocalMatch(code);
  assert.equal(readWalletStrict("Marco").balance, 1217);
  assert.equal(readWalletStrict("Marco").transactions.length, 2);
});

test("abandono perde a entrada e outra conta não consegue jogar, pagar ou abandonar", async () => {
  const match = snapshot();
  await startLocalMatch(match);
  storage.setItem("croebet:demo-username", "OutraConta");
  for (const operation of [() => prepareWagerMatch(code), () => saveWagerProgress(code, match.game, transition(match.game, { type: "draw" })), () => leaveLocalMatch(code)])
    await assert.rejects(operation(), /conta/);
  storage.setItem("croebet:demo-username", "Marco");
  await leaveLocalMatch(code);
  assert.equal(readMatch(), null);
  assert.equal(readWalletStrict("Marco").balance, 1017);
});

test("partidas concorrentes têm entradas independentes e rejeitam jogadas antigas", async () => {
  const match = snapshot();
  const starts = await Promise.allSettled([startLocalMatch(match), startLocalMatch({ ...match, code: "123456ABCDEF" })]);
  assert.equal(starts.filter(result => result.status === "fulfilled").length, 2);
  const next = transition(match.game, { type: "draw" });
  const moves = await Promise.allSettled([saveWagerProgress(code, match.game, next), saveWagerProgress(code, match.game, next)]);
  assert.equal(moves.filter(result => result.status === "fulfilled").length, 1);
  assert.deepEqual(readMatch().game, next);
  assert.equal(readWalletStrict("Marco").balance, 967);
  const other = readMatch(storage, "123456ABCDEF");
  assert.deepEqual(other.game, match.game);
  await leaveLocalMatch(code);
  assert.deepEqual(readMatch(storage, "123456ABCDEF"), other);
  assert.equal(readMatch(storage, code), null);
});

test("limite da carteira e códigos já usados não geram partida nem débito", async () => {
  writeWalletStrict("Marco", { ...structuredClone(initialWallet), balance: Number.MAX_SAFE_INTEGER });
  await assert.rejects(startLocalMatch(snapshot(1)), /limite/);
  assert.equal(readMatch(), null);
  assert.equal(readWalletStrict("Marco").balance, Number.MAX_SAFE_INTEGER);
  writeWalletStrict("Marco", structuredClone(initialWallet));
  await startLocalMatch(snapshot());
  await leaveLocalMatch(code);
  await assert.rejects(startLocalMatch(snapshot()), /código/);
  assert.equal(readMatch(), null);
  assert.equal(readWalletStrict("Marco").balance, 1017);
});

test("falha ao salvar jogada mantém o estado anterior, a entrada e a retomada", async () => {
  const match = snapshot();
  await startLocalMatch(match);
  const next = transition(match.game, { type: "draw" });
  storage.fail = key => key === matchStorageKey;
  await assert.rejects(saveWagerProgress(code, match.game, next), /quota/);
  assert.deepEqual(readMatch().game, match.game);
  storage.fail = null;
  await prepareWagerMatch(code);
  await saveWagerProgress(code, match.game, next);
  assert.deepEqual(readMatch().game, next);
  assert.equal(readWalletStrict("Marco").balance, 1017);
  assert.equal(readWalletStrict("Marco").transactions.length, 1);
});

test("partidas antigas continuam livres e não movimentam a carteira", async () => {
  const match = snapshot();
  delete match.wager;
  saveMatch(match);
  assert.equal(readMatch().wager, undefined);
  await leaveLocalMatch(code);
  assert.equal(readWalletStrict("Marco").balance, initialWallet.balance);
});


test("três partidas têm débitos e prêmios isolados, sem sobrescrever resultados", async () => {
  const codes = [code, "123456ABCDEF", "AABBCCDDEEFF"];
  const matches = codes.map(code => ({ ...snapshot(), code }));
  await Promise.all(matches.map(match => startLocalMatch(match)));
  assert.equal(readWalletStrict("Marco").balance, initialWallet.balance - 150);
  for (const match of matches) {
    await prepareWagerMatch(match.code);
    assert.deepEqual(readMatch(storage, match.code), match);
  }
  const end = finished(matches[1].game, [250, 100, 100, 100]);
  await saveWagerProgress(codes[1], matches[1].game, end);
  await Promise.all([prepareWagerMatch(codes[1]), prepareWagerMatch(codes[1])]);
  assert.equal(readWalletStrict("Marco").balance, initialWallet.balance - 150 + 200);
  assert.equal(readWalletStrict("Marco").transactions.filter(tx => tx.id.endsWith(":prize")).length, 1);
  await leaveLocalMatch(codes[0]);
  assert.equal(readMatch(storage, codes[1]).game.phase, "over");
  assert.deepEqual(readMatch(storage, codes[2]), matches[2]);
});
