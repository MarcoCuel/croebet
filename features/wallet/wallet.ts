import type { Prediction } from "@/features/betting/types";

export type Wallet = {
  balance: number;
  predictions: Prediction[];
  lastClaim: string;
};
export const dailyReward = 67;
export const initialWallet: Wallet = {
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
    Number.isSafeInteger(entry.odds) &&
    Number(entry.odds) > 0
  );
}

export function addCroins(wallet: Wallet, amount: number): Wallet {
  if (
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > 999999 ||
    !Number.isSafeInteger(wallet.balance + amount)
  )
    return wallet;
  return { ...wallet, balance: wallet.balance + amount };
}

export function claimReward(wallet: Wallet, date: string): Wallet {
  if (
    wallet.lastClaim === date ||
    !Number.isSafeInteger(wallet.balance + dailyReward)
  )
    return wallet;
  return { ...wallet, balance: wallet.balance + dailyReward, lastClaim: date };
}

export function registerPrediction(
  wallet: Wallet,
  prediction: Prediction,
): Wallet {
  if (!isPrediction(prediction) || prediction.stake > wallet.balance)
    return wallet;
  return {
    ...wallet,
    balance: wallet.balance - prediction.stake,
    predictions: [prediction, ...wallet.predictions],
  };
}
