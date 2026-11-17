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
export const dailyReward = 67;
export const initialWallet: Wallet = {
  transactions: [],
  balance: 1067,
  predictions: [],
  lastClaim: "",
};
export const formatBalance = new Intl.NumberFormat("pt-BR");

export function today() {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  }).format();
}

export function isPrediction(value: unknown): value is Prediction {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.market === "string" &&
    typeof entry.outcome === "string" &&
    Number.isSafeInteger(entry.stake) &&
    Number(entry.stake) > 0 &&
    (entry.odds === undefined ||
      (Number.isSafeInteger(entry.odds) && Number(entry.odds) > 0))
  );
}

export function isWalletTransaction(value: unknown): value is WalletTransaction {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.createdAt === "string" &&
    Number.isFinite(Date.parse(entry.createdAt)) &&
    typeof entry.description === "string" &&
    Number.isSafeInteger(entry.amount) && entry.amount !== 0 &&
    Number.isSafeInteger(entry.balance) && Number(entry.balance) >= 0
  );
}

function recordTransaction(wallet: Wallet, amount: number, description: string): Wallet {
  const balance = wallet.balance + amount;
  return {
    ...wallet,
    balance,
    transactions: [{
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      description,
      amount,
      balance,
    }, ...wallet.transactions],
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
  return recordTransaction(wallet, amount, "Croins de teste");
}

export function claimReward(wallet: Wallet, date: string): Wallet {
  if (
    wallet.lastClaim === date ||
    !Number.isSafeInteger(wallet.balance + dailyReward)
  )
    return wallet;
  return { ...recordTransaction(wallet, dailyReward, "Bônus diário"), lastClaim: date };
}

export function registerPrediction(
  wallet: Wallet,
  prediction: Prediction,
): Wallet {
  if (!isPrediction(prediction) || prediction.stake > wallet.balance)
    return wallet;
  return {
    ...recordTransaction(wallet, -prediction.stake, `Aposta · ${prediction.market} · ${prediction.outcome}`),
    predictions: [prediction, ...wallet.predictions],
  };
}
