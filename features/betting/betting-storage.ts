import { announceDemoData, withDemoLock } from "@/lib/demo-storage";
import { demoPermissions } from "@/features/auth/permissions";
import {
  readUsername,
  readWalletStrict,
  writeWalletStrict,
} from "@/features/auth/session-storage";
import {
  readSiteConfig,
  writeSiteConfig,
  type SiteConfig,
} from "@/features/admin/site-storage";
import {
  addCroins,
  removeCroins,
  registerPrediction,
} from "@/features/wallet/wallet";
import type { Wallet } from "@/features/wallet/wallet";
import type {
  IdentifiedPrediction,
  Prediction,
} from "@/features/betting/types";
import type { Market, MarketStatus } from "@/features/betting/markets";
import {
  acceptsPredictions,
  applySettlement,
  makeSettlement,
  transitionMarket,
  validOutcome,
} from "@/features/betting/settlement";

export type MarketActivity = {
  entries: IdentifiedPrediction[];
  legacyCount: number;
  legacyEntries: { username: string; outcome: string; stake: number }[];
  total: number;
  participants: number;
};
export function requireLocalAdmin() {
  if (
    !demoPermissions(
      readUsername(),
      process.env.NEXT_PUBLIC_DEMO_ADMIN_USERS,
      process.env.NODE_ENV === "development",
    ).canManageSite
  )
    throw new Error("Operação não autorizada.");
}
function wallets(): { username: string; wallet: Wallet }[] {
  const prefix = "croebet:demo-wallet:";
  return Object.keys(localStorage)
    .filter((key) => key.startsWith(prefix))
    .sort()
    .map((key) => ({
      username: key.slice(prefix.length),
      wallet: readWalletStrict(key.slice(prefix.length)),
    }));
}
export function marketActivity(market: Market): MarketActivity {
  requireLocalAdmin();
  const all = wallets();
  const entries: IdentifiedPrediction[] = [];
  const legacyEntries: { username: string; outcome: string; stake: number }[] =
    [];
  for (const { username, wallet } of all)
    for (const p of wallet.predictions) {
      if (p.id && p.marketId === market.id) {
        if (p.username?.toLowerCase() !== username)
          throw new Error("Participante inconsistente na carteira.");
        entries.push(p as IdentifiedPrediction);
      } else if (!p.id && p.market === market.question)
        legacyEntries.push({ username, outcome: p.outcome, stake: p.stake });
    }
  if (new Set(entries.map((e) => e.id)).size !== entries.length)
    throw new Error("Existem identificadores de palpite duplicados.");
  const total = entries.reduce((sum, e) => sum + e.stake, 0);
  if (!Number.isSafeInteger(total))
    throw new Error("O total ultrapassa o limite de Croins.");
  return {
    entries: entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    legacyCount: legacyEntries.length,
    legacyEntries,
    total,
    participants: new Set(entries.map((e) => e.username.toLowerCase())).size,
  };
}
export async function commitWallet(
  username: string,
  update: (wallet: Wallet) => Wallet,
) {
  return withDemoLock(() => {
    if (readUsername()?.toLowerCase() !== username.toLowerCase())
      throw new Error("A sessão mudou. Atualize a página.");
    const wallet = readWalletStrict(username);
    const next = update(wallet);
    if (next !== wallet) {
      writeWalletStrict(username, next);
      announceDemoData();
    }
    return next !== wallet;
  });
}
export async function placeLocalPrediction(
  username: string,
  selection: Prediction,
) {
  return commitWallet(username, (wallet) => {
    const config = readSiteConfig();
    const market = config.markets.find((m) => m.id === selection.marketId);
    if (
      !market ||
      !acceptsPredictions(market) ||
      !validOutcome(market, selection.outcome)
    )
      throw new Error(
        "Esta aposta não está mais disponível. Atualize a seleção.",
      );
    const entry: IdentifiedPrediction = {
      id: crypto.randomUUID(),
      marketId: market.id,
      market: market.question,
      outcome: selection.outcome,
      stake: selection.stake,
      username,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    const next = registerPrediction(wallet, entry);
    if (next === wallet)
      throw new Error("Valor inválido ou saldo insuficiente.");
    return next;
  });
}
function changeMarket(config: SiteConfig, market: Market) {
  writeSiteConfig({
    ...config,
    markets: config.markets.map((m) => (m.id === market.id ? market : m)),
  });
  announceDemoData();
}
export async function saveLocalMarket(next: Market, creating: boolean) {
  return withDemoLock(() => {
    requireLocalAdmin();
    const config = readSiteConfig();
    const previous = config.markets.find((m) => m.id === next.id);
    if (creating) {
      if (previous || next.status !== "draft" || next.settlement)
        throw new Error("Não foi possível criar esta aposta.");
      writeSiteConfig({ ...config, markets: [...config.markets, next] });
      announceDemoData();
      return;
    }
    if (!previous || !["draft", "open", "paused"].includes(previous.status))
      throw new Error("A configuração desta aposta está bloqueada.");
    const activity = marketActivity(previous);
    if (activity.entries.length || activity.legacyCount) {
      const fixed = (m: Market) =>
        JSON.stringify({
          question: m.question,
          type: m.type,
          criterion: m.criterion,
          options: m.type === "number" ? m.unit : m.options,
        });
      if (fixed(previous) !== fixed(next))
        throw new Error(
          "Pergunta, formato e regras não podem mudar após o primeiro palpite.",
        );
    }
    if (next.status !== previous.status || next.settlement)
      throw new Error(
        "Use as ações de status e finalização para alterar esta aposta.",
      );
    changeMarket(config, next);
  });
}
export async function changeLocalMarketStatus(
  id: string,
  status: MarketStatus,
) {
  return withDemoLock(() => {
    requireLocalAdmin();
    const config = readSiteConfig();
    const market = config.markets.find((m) => m.id === id);
    if (!market) throw new Error("Aposta não encontrada.");
    changeMarket(config, transitionMarket(market, status));
  });
}
export async function deleteLocalMarket(id: string) {
  return withDemoLock(() => {
    requireLocalAdmin();
    const config = readSiteConfig();
    const market = config.markets.find((m) => m.id === id);
    if (!market) throw new Error("Aposta não encontrada.");
    const activity = marketActivity(market);
    if (activity.entries.length || activity.legacyCount || market.settlement)
      throw new Error(
        "Apostas com participantes devem ser canceladas com devolução.",
      );
    writeSiteConfig({
      ...config,
      markets: config.markets.filter((m) => m.id !== id),
    });
    announceDemoData();
  });
}
export async function resolveLocalMarket(
  id: string,
  result: string | null,
  cancel = false,
) {
  return withDemoLock(() => {
    requireLocalAdmin();
    const config = readSiteConfig();
    const market = config.markets.find((m) => m.id === id);
    if (!market) throw new Error("Aposta não encontrada.");
    const activity = marketActivity(market);
    const settlement = makeSettlement(
      market,
      activity.entries,
      result,
      crypto.randomUUID(),
      new Date().toISOString(),
      cancel,
    );
    changeMarket(config, { ...market, status: "resolved", settlement });
  });
}
export async function payLocalMarket(id: string) {
  return withDemoLock(() => {
    requireLocalAdmin();
    const config = readSiteConfig();
    const market = config.markets.find((m) => m.id === id);
    if (!market?.settlement)
      throw new Error("Apure o resultado antes de pagar.");
    if (["paid", "cancelled"].includes(market.status)) return;
    if (market.status !== "resolved")
      throw new Error("Esta aposta não pode ser paga agora.");
    const plan = market.settlement;
    const names = [
      ...new Set(plan.allocations.map((a) => a.username.toLowerCase())),
    ].sort();
    // Preflight every account before the first write. Per-account receipts make
    // quota failures and interrupted batches safely resumable.
    const updates = names.map((name) => {
      const wallet = readWalletStrict(name);
      return { name, wallet, next: applySettlement(wallet, name, plan) };
    });
    try {
      for (const { name, wallet, next } of updates)
        if (next !== wallet) writeWalletStrict(name, next);
      changeMarket(config, {
        ...market,
        status:
          plan.kind === "refund" && plan.result === null ? "cancelled" : "paid",
      });
    } finally {
      announceDemoData();
    }
  });
}

export async function creditLocalWallet(username: string, amount: number) {
  return withDemoLock(() => {
    requireLocalAdmin();
    const wallet = readWalletStrict(username);
    const next = addCroins(wallet, amount);
    if (next === wallet)
      throw new Error(
        "Informe um valor inteiro de 1 a 999999, sem exceder o limite de saldo.",
      );
    writeWalletStrict(username, next);
    announceDemoData();
  });
}

// The prototype only supports adjusting the signed-in administrator's wallet.
export async function adjustOwnLocalWallet(
  username: string,
  amount: number,
  direction: "add" | "remove",
) {
  return withDemoLock(() => {
    requireLocalAdmin();
    if (readUsername()?.toLowerCase() !== username.toLowerCase())
      throw new Error("A sessão mudou. Atualize a página.");
    if (direction !== "add" && direction !== "remove")
      throw new Error("Operação inválida.");
    const wallet = readWalletStrict(username);
    const next =
      direction === "add"
        ? addCroins(wallet, amount)
        : removeCroins(wallet, amount);
    if (next === wallet)
      throw new Error(
        "Informe um valor inteiro de 1 a 999999 e verifique o saldo disponível.",
      );
    writeWalletStrict(username, next);
    announceDemoData();
  });
}
