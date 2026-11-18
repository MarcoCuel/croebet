import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { registerHooks } from "node:module";

// Exercise the actual local repository and its persistence failures, while Node
// resolves the same @/ aliases used by Next. No UI or browser server is needed.
registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier.startsWith("@/")
        ? new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href
        : specifier,
      context,
    );
  },
});
const { readSiteConfig, writeSiteConfig, initialSiteConfig, siteConfigKey } =
  await import("../features/admin/site-storage.ts");
const { readWalletStrict, writeWalletStrict } =
  await import("../features/auth/session-storage.ts");
const { initialWallet } = await import("../features/wallet/wallet.ts");
const {
  changeLocalMarketStatus,
  creditLocalWallet,
  deleteLocalMarket,
  marketActivity,
  payLocalMarket,
  placeLocalPrediction,
  resolveLocalMarket,
  saveLocalMarket,
} = await import("../features/betting/betting-storage.ts");

class Storage {
  fail = null;
  getItem(key) {
    return Object.hasOwn(this, key) ? this[key] : null;
  }
  setItem(key, value) {
    if (this.fail?.(key, value)) throw new Error("quota simulada");
    Object.defineProperty(this, key, {
      value: String(value),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  removeItem(key) {
    delete this[key];
  }
}
let storage;
function actor(name) {
  storage.setItem("croebet:demo-username", name);
}
function current() {
  return readSiteConfig().markets.find((m) => m.id === "peruca");
}
function seed(name) {
  writeWalletStrict(name, structuredClone(initialWallet));
}
async function place(name, outcome, stake) {
  actor(name);
  seed(name);
  await placeLocalPrediction(name, {
    marketId: "peruca",
    market: "snapshot externo ignorado",
    outcome,
    stake,
  });
}
async function prepare() {
  await place("Ana", "Sim", 50);
  await place("Beto", "Sim", 200);
  await place("Caio", "Não", 750);
  actor("Tonho");
  await changeLocalMarketStatus("peruca", "closed");
  await resolveLocalMarket("peruca", "Sim");
}
beforeEach(() => {
  storage = new Storage();
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  const events = new EventTarget();
  events.localStorage = storage;
  Object.defineProperty(globalThis, "window", {
    value: events,
    configurable: true,
  });
  let chain = Promise.resolve();
  Object.defineProperty(globalThis, "navigator", {
    value: {
      locks: {
        request(_key, operation) {
          const next = chain.then(operation);
          chain = next.catch(() => {});
          return next;
        },
      },
    },
    configurable: true,
  });
  process.env.NODE_ENV = "development";
  process.env.NEXT_PUBLIC_DEMO_ADMIN_USERS = "Tonho";
  actor("Tonho");
  writeSiteConfig(structuredClone(initialSiteConfig));
});

test("palpite persiste identificação e débito juntos; edição fecha regras após participação", async () => {
  await place("Ana", "Sim", 50);
  const wallet = readWalletStrict("Ana");
  assert.equal(wallet.balance, 1017);
  assert.equal(wallet.predictions[0].marketId, "peruca");
  assert.equal(wallet.predictions[0].market, current().question);
  assert.ok(wallet.predictions[0].id);
  actor("Tonho");
  const stats = marketActivity(current());
  assert.equal(stats.total, 50);
  assert.equal(stats.participants, 1);
  await assert.rejects(
    saveLocalMarket({ ...current(), options: ["Outra", "Não"] }, false),
    /não podem mudar/,
  );
  await assert.rejects(deleteLocalMarket("peruca"), /canceladas/);
});

test("falha ao gravar palpite não debita nem exibe registro inexistente", async () => {
  actor("Ana");
  seed("Ana");
  storage.fail = (key) => key === "croebet:demo-wallet:ana";
  await assert.rejects(
    placeLocalPrediction("Ana", {
      marketId: "peruca",
      market: "Pergunta",
      outcome: "Sim",
      stake: 20,
    }),
    /quota/,
  );
  const wallet = readWalletStrict("Ana");
  assert.equal(wallet.balance, 1067);
  assert.equal(wallet.predictions.length, 0);
});

test("cliques concorrentes não gastam o mesmo saldo duas vezes", async () => {
  actor("Ana");
  seed("Ana");
  const selection = {
    marketId: "peruca",
    market: "Pergunta",
    outcome: "Sim",
    stake: 1000,
  };
  const attempts = await Promise.allSettled([
    placeLocalPrediction("Ana", selection),
    placeLocalPrediction("Ana", selection),
  ]);
  assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 1);
  assert.equal(readWalletStrict("Ana").balance, 67);
  assert.equal(readWalletStrict("Ana").predictions.length, 1);
});

test("pagamento credita ganhadores, atualiza perdedores e é idempotente", async () => {
  await prepare();
  await payLocalMarket("peruca");
  assert.equal(current().status, "paid");
  assert.equal(readWalletStrict("Ana").balance, 1217);
  assert.equal(readWalletStrict("Beto").balance, 1667);
  assert.equal(readWalletStrict("Caio").balance, 317);
  assert.equal(readWalletStrict("Caio").predictions[0].status, "lost");
  const snapshot = JSON.stringify(readWalletStrict("Ana"));
  await payLocalMarket("peruca");
  assert.equal(JSON.stringify(readWalletStrict("Ana")), snapshot);
});

test("lote interrompido retoma somente contas pendentes", async () => {
  await prepare();
  storage.fail = (key) => key === "croebet:demo-wallet:beto";
  await assert.rejects(payLocalMarket("peruca"), /quota/);
  assert.equal(current().status, "resolved");
  assert.equal(readWalletStrict("Ana").balance, 1217);
  assert.equal(readWalletStrict("Beto").balance, 867);
  storage.fail = null;
  await payLocalMarket("peruca");
  assert.equal(current().status, "paid");
  assert.equal(readWalletStrict("Ana").balance, 1217);
  assert.equal(
    readWalletStrict("Ana").transactions.filter((t) =>
      t.id.startsWith("settlement:"),
    ).length,
    1,
  );
  assert.equal(readWalletStrict("Beto").balance, 1667);
});

test("falha ao marcar lote concluído também pode ser retomada sem duplicar créditos", async () => {
  await prepare();
  storage.fail = (key) => key === siteConfigKey;
  await assert.rejects(payLocalMarket("peruca"), /quota/);
  assert.equal(readWalletStrict("Ana").balance, 1217);
  storage.fail = null;
  await payLocalMarket("peruca");
  assert.equal(current().status, "paid");
  assert.equal(readWalletStrict("Ana").balance, 1217);
});

test("overflow numa conta bloqueia o lote antes do primeiro crédito", async () => {
  await prepare();
  const beto = readWalletStrict("Beto");
  writeWalletStrict("Beto", { ...beto, balance: Number.MAX_SAFE_INTEGER });
  await assert.rejects(payLocalMarket("peruca"), /limite/);
  assert.equal(readWalletStrict("Ana").balance, 1017);
  assert.equal(current().status, "resolved");
});

test("cancelamento e ausência de vencedores devolvem sem apagar os palpites", async () => {
  await place("Ana", "Não", 23);
  actor("Tonho");
  await resolveLocalMarket("peruca", null, true);
  await payLocalMarket("peruca");
  assert.equal(current().status, "cancelled");
  assert.equal(readWalletStrict("Ana").balance, 1067);
  assert.equal(readWalletStrict("Ana").predictions[0].status, "refunded");
});

test("palpites antigos ficam visíveis e são preservados fora da apuração automática", async () => {
  seed("Antigo");
  const old = {
    ...readWalletStrict("Antigo"),
    balance: 777,
    predictions: [{ market: current().question, outcome: "Sim", stake: 20 }],
  };
  writeWalletStrict("Antigo", old);
  assert.equal(marketActivity(current()).legacyCount, 1);
  await changeLocalMarketStatus("peruca", "closed");
  await resolveLocalMarket("peruca", "Sim");
  await payLocalMarket("peruca");
  assert.deepEqual(readWalletStrict("Antigo"), old);
});

test("migração remove categoria e converte disponibilidade sem apagar jogos ou Sobre", () => {
  const config = structuredClone(initialSiteConfig);
  config.markets = config.markets.map((m) => {
    const { status, endsAt, ...legacy } = m;
    void status;
    void endsAt;
    return { ...legacy, enabled: m.id !== "peruca", category: "Legado" };
  });
  storage.setItem(siteConfigKey, JSON.stringify(config));
  const migrated = readSiteConfig();
  assert.equal(
    migrated.markets.find((m) => m.id === "peruca").status,
    "paused",
  );
  assert.equal("category" in migrated.markets[0], false);
  assert.deepEqual(migrated.games, config.games);
  assert.deepEqual(migrated.about, config.about);
});

test("prazo expirado bloqueia entrada mesmo se a página estava aberta", async () => {
  const config = readSiteConfig();
  config.markets = config.markets.map((m) =>
    m.id === "peruca" ? { ...m, endsAt: "2000-01-01T00:00:00.000Z" } : m,
  );
  writeSiteConfig(config);
  actor("Ana");
  seed("Ana");
  await assert.rejects(
    placeLocalPrediction("Ana", {
      marketId: "peruca",
      market: "Pergunta",
      outcome: "Sim",
      stake: 10,
    }),
    /disponível/,
  );
  assert.equal(readWalletStrict("Ana").balance, 1067);
  assert.equal(current().status, "closed");
});

test("usuários comuns não criam, alteram, apuram, pagam ou creditam Croins", async () => {
  actor("Comum");
  seed("Comum");
  await assert.rejects(
    saveLocalMarket({ ...current(), id: "nova", status: "draft" }, true),
    /autorizada/,
  );
  await assert.rejects(
    changeLocalMarketStatus("peruca", "closed"),
    /autorizada/,
  );
  await assert.rejects(resolveLocalMarket("peruca", "Sim"), /autorizada/);
  await assert.rejects(payLocalMarket("peruca"), /autorizada/);
  await assert.rejects(creditLocalWallet("Comum", 50), /autorizada/);
  assert.equal(readWalletStrict("Comum").balance, 1067);
});
