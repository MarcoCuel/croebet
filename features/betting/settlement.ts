import type { Market, MarketStatus, Settlement } from "./markets.ts";
import type { IdentifiedPrediction } from "./types.ts";
import type { Wallet } from "../wallet/wallet.ts";

export function acceptsPredictions(market: Market, now = Date.now()) {
  return (
    market.status === "open" &&
    (!market.endsAt || Date.parse(market.endsAt) > now)
  );
}
export function validOutcome(market: Market, outcome: string) {
  if (market.type !== "number") return market.options.includes(outcome);
  const match = /^(0|[1-9]\d*)$/.exec(outcome.replace(` ${market.unit}`, ""));
  return (
    !!match &&
    Number.isSafeInteger(Number(match[1])) &&
    outcome === `${Number(match[1])} ${market.unit}`
  );
}
export function transitionMarket(market: Market, status: MarketStatus): Market {
  const allowed: Partial<Record<MarketStatus, MarketStatus[]>> = {
    draft: ["open"],
    open: ["paused", "closed"],
    paused: ["open", "closed"],
  };
  if (
    !allowed[market.status]?.includes(status) ||
    (status === "open" &&
      market.endsAt &&
      Date.parse(market.endsAt) <= Date.now())
  )
    throw new Error(
      "Esta alteração de status não está disponível. Revise o prazo de encerramento.",
    );
  return { ...market, status };
}
export function makeSettlement(
  market: Market,
  entries: IdentifiedPrediction[],
  result: string | null,
  id: string,
  createdAt: string,
  cancel = false,
): Settlement {
  if (
    market.settlement ||
    ["paid", "cancelled", "resolved"].includes(market.status) ||
    (!cancel && market.status !== "closed")
  )
    throw new Error(
      "Encerre a aposta antes de apurar. Uma apuração existente não pode ser substituída.",
    );
  if (!cancel && (result === null || !validOutcome(market, result)))
    throw new Error("Informe um resultado válido.");
  if (
    new Set(entries.map((e) => e.id)).size !== entries.length ||
    entries.some(
      (e) =>
        e.marketId !== market.id ||
        !validOutcome(market, e.outcome) ||
        !Number.isSafeInteger(e.stake) ||
        e.stake < 1 ||
        e.settlementId,
    )
  )
    throw new Error("Os palpites desta aposta são inconsistentes.");
  const totalBig = entries.reduce((sum, e) => sum + BigInt(e.stake), BigInt(0));
  if (totalBig > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("O total ultrapassa o limite de Croins.");
  const winners = entries.filter((e) => e.outcome === result);
  const refund = cancel || winners.length === 0;
  const winningTotal = winners.reduce(
    (sum, e) => sum + BigInt(e.stake),
    BigInt(0),
  );
  const amounts = new Map<string, number>();
  if (refund) entries.forEach((e) => amounts.set(e.id, e.stake));
  else {
    const shares = winners.map((e) => ({
      id: e.id,
      amount: (totalBig * BigInt(e.stake)) / winningTotal,
      remainder: (totalBig * BigInt(e.stake)) % winningTotal,
    }));
    let remainder =
      totalBig - shares.reduce((sum, e) => sum + e.amount, BigInt(0));
    shares.sort((a, b) =>
      a.remainder === b.remainder
        ? a.id < b.id
          ? -1
          : a.id > b.id
            ? 1
            : 0
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
    for (const share of shares) {
      amounts.set(
        share.id,
        Number(share.amount + (remainder > BigInt(0) ? BigInt(1) : BigInt(0))),
      );
      if (remainder > BigInt(0)) remainder--;
    }
  }
  return {
    id,
    marketId: market.id,
    kind: refund ? "refund" : "payout",
    result: cancel ? null : result,
    createdAt,
    total: Number(totalBig),
    allocations: entries.map((e) => ({
      predictionId: e.id,
      username: e.username,
      amount: amounts.get(e.id) ?? 0,
    })),
  };
}

/** Apply an account's entire allocation and receipt in one wallet write. */
export function applySettlement(
  wallet: Wallet,
  username: string,
  plan: Settlement,
): Wallet {
  if (!isSettlement(plan)) throw new Error("Plano de liquidação inválido.");
  const mine = plan.allocations.filter(
    (a) => a.username.toLowerCase() === username.toLowerCase(),
  );
  if (!mine.length) return wallet;
  const entries = mine.map((a) => {
    const prediction = wallet.predictions.find((p) => p.id === a.predictionId);
    if (
      !prediction ||
      prediction.marketId !== plan.marketId ||
      wallet.predictions.filter((p) => p.id === a.predictionId).length !== 1 ||
      prediction.username?.toLowerCase() !== username.toLowerCase()
    )
      throw new Error(`Palpite não encontrado para ${username}.`);
    if (prediction.settlementId && prediction.settlementId !== plan.id)
      throw new Error("Este palpite já pertence a outra liquidação.");
    return { allocation: a, prediction };
  });
  const pending = entries.filter((e) => !e.prediction.settlementId);
  if (!pending.length) {
    const expected = mine.reduce((sum, a) => sum + a.amount, 0);
    const receipt = wallet.transactions.find(
      (t) => t.id === `settlement:${plan.id}:${username.toLowerCase()}`,
    );
    if (
      entries.some(
        ({ allocation, prediction }) =>
          prediction.payout !== allocation.amount ||
          prediction.status !==
            (plan.kind === "refund"
              ? "refunded"
              : allocation.amount > 0
                ? "won"
                : "lost"),
      ) ||
      (expected > 0 && receipt?.amount !== expected)
    )
      throw new Error("Recibo e palpites pagos estão inconsistentes.");
    return wallet;
  }
  if (pending.length !== entries.length)
    throw new Error("Recibos de pagamento inconsistentes nesta carteira.");
  const amount = pending.reduce((sum, e) => sum + e.allocation.amount, 0);
  if (
    !Number.isSafeInteger(amount) ||
    !Number.isSafeInteger(wallet.balance + amount)
  )
    throw new Error(`O saldo de ${username} ultrapassaria o limite permitido.`);
  const txId = `settlement:${plan.id}:${username.toLowerCase()}`;
  if (wallet.transactions.some((t) => t.id === txId))
    throw new Error(
      "Recibo de pagamento já existente sem atualização dos palpites.",
    );
  const balance = wallet.balance + amount;
  return {
    ...wallet,
    balance,
    predictions: wallet.predictions.map((p) => {
      const allocation = mine.find((a) => a.predictionId === p.id);
      return allocation
        ? {
            ...p,
            settlementId: plan.id,
            payout: allocation.amount,
            status:
              plan.kind === "refund"
                ? "refunded"
                : allocation.amount > 0
                  ? "won"
                  : "lost",
          }
        : p;
    }),
    transactions:
      amount > 0
        ? [
            {
              id: txId,
              createdAt: plan.createdAt,
              amount,
              balance,
              description: `${plan.kind === "refund" ? "Devolução de aposta" : "Prêmio de aposta"} · ${entries[0].prediction.market}`,
            },
            ...wallet.transactions,
          ]
        : wallet.transactions,
  };
}

export function isSettlement(value: unknown): value is Settlement {
  if (!value || typeof value !== "object") return false;
  const s = value as Settlement;
  return (
    typeof s.marketId === "string" &&
    !!s.marketId &&
    typeof s.id === "string" &&
    !!s.id &&
    ["payout", "refund"].includes(s.kind) &&
    (s.result === null || typeof s.result === "string") &&
    typeof s.createdAt === "string" &&
    Number.isFinite(Date.parse(s.createdAt)) &&
    Number.isSafeInteger(s.total) &&
    s.total >= 0 &&
    Array.isArray(s.allocations) &&
    new Set(s.allocations.map((a) => a?.predictionId)).size ===
      s.allocations.length &&
    s.allocations.every(
      (a) =>
        a &&
        typeof a.predictionId === "string" &&
        !!a.predictionId &&
        typeof a.username === "string" &&
        !!a.username &&
        Number.isSafeInteger(a.amount) &&
        a.amount >= 0,
    ) &&
    s.allocations.reduce((sum, a) => sum + BigInt(a.amount), BigInt(0)) ===
      BigInt(s.total)
  );
}
