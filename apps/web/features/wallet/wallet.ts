import type { Prediction } from "@/features/betting/types";

export type WalletTransaction = {
  id: string;
  createdAt: string;
  description: string;
  amount: number;
  balance: number;
};

export type Wallet = {
  transactions: WalletTransaction[];
  balance: number;
  predictions: Prediction[];
  lastClaim: string;
};
export const initialWallet: Wallet = {
  transactions: [],
  balance: 0,
  predictions: [],
  lastClaim: "",
};
export const formatBalance = new Intl.NumberFormat("pt-BR");

export function isPrediction(value: unknown): value is Prediction {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    (entry.id === undefined ||
      (typeof entry.id === "string" &&
        !!entry.id &&
        typeof entry.marketId === "string" &&
        !!entry.marketId &&
        typeof entry.username === "string" &&
        !!entry.username &&
        typeof entry.createdAt === "string" &&
        Number.isFinite(Date.parse(entry.createdAt)))) &&
    (entry.settlementId === undefined ||
      (typeof entry.settlementId === "string" &&
        !!entry.settlementId &&
        Number.isSafeInteger(entry.payout) &&
        Number(entry.payout) >= 0 &&
        ["won", "lost", "refunded"].includes(String(entry.status)))) &&
    typeof entry.market === "string" &&
    typeof entry.outcome === "string" &&
    Number.isSafeInteger(entry.stake) &&
    Number(entry.stake) > 0 &&
    (entry.odds === undefined ||
      (Number.isSafeInteger(entry.odds) && Number(entry.odds) > 0))
  );
}

export function isWalletTransaction(
  value: unknown,
): value is WalletTransaction {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.createdAt === "string" &&
    Number.isFinite(Date.parse(entry.createdAt)) &&
    typeof entry.description === "string" &&
    Number.isSafeInteger(entry.amount) &&
    entry.amount !== 0 &&
    Number.isSafeInteger(entry.balance) &&
    Number(entry.balance) >= 0
  );
}

function recordTransaction(
  wallet: Wallet,
  amount: number,
  description: string,
): Wallet {
  const balance = wallet.balance + amount;
  return {
    ...wallet,
    balance,
    transactions: [
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        description,
        amount,
        balance,
      },
      ...wallet.transactions,
    ],
  };
}

export function addCroins(wallet: Wallet, amount: number): Wallet {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > 999999 ||
    !Number.isSafeInteger(wallet.balance + amount)
  )
    return wallet;
  return recordTransaction(wallet, amount, "Croins adicionados pelo admin");
}

export function removeCroins(wallet: Wallet, amount: number): Wallet {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > 999999 ||
    amount > wallet.balance
  )
    return wallet;
  return recordTransaction(wallet, -amount, "Retirada de Croins pelo admin");
}

export function registerPrediction(
  wallet: Wallet,
  prediction: Prediction,
): Wallet {
  if (!isPrediction(prediction) || prediction.stake > wallet.balance)
    return wallet;
  return {
    ...recordTransaction(
      wallet,
      -prediction.stake,
      `Aposta · ${prediction.market} · ${prediction.outcome}`,
    ),
    predictions: [prediction, ...wallet.predictions],
  };
}
