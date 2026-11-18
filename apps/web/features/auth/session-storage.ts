import {
  initialWallet,
  isPrediction,
  isWalletTransaction,
  type Wallet,
} from "@/features/wallet/wallet";

const usernameStorageKey = "croebet:demo-username";
function walletKey(name: string) {
  return `croebet:demo-wallet:${name.toLowerCase()}`;
}

export function readUsername(): string | null {
  try {
    return window.localStorage.getItem(usernameStorageKey)?.trim() || null;
  } catch {
    return null;
  }
}

export function readWallet(name: string): Wallet {
  try {
    const saved = window.localStorage.getItem(walletKey(name));
    if (saved) {
      const wallet: unknown = JSON.parse(saved);
      if (wallet && typeof wallet === "object") {
        const value = wallet as Record<string, unknown>;
        if (
          Number.isSafeInteger(value.balance) &&
          Number(value.balance) >= 0 &&
          Array.isArray(value.predictions) &&
          value.predictions.every(isPrediction) &&
          typeof value.lastClaim === "string"
        )
          return {
            balance: Number(value.balance),
            predictions: value.predictions,
            lastClaim: value.lastClaim,
            transactions: Array.isArray(value.transactions)
              ? value.transactions.filter(isWalletTransaction)
              : [],
          };
      }
    }
  } catch {
    /* The demo remains usable when storage is unavailable. */
  }
  return initialWallet;
}

export function persistUsername(name: string | null) {
  try {
    if (name) window.localStorage.setItem(usernameStorageKey, name);
    else window.localStorage.removeItem(usernameStorageKey);
  } catch {
    /* Keep the session usable in memory. */
  }
}

export function persistWallet(name: string, wallet: Wallet) {
  try {
    window.localStorage.setItem(walletKey(name), JSON.stringify(wallet));
  } catch {
    /* Keep the wallet usable in memory. */
  }
}

export function readWalletStrict(name: string): Wallet {
  const raw = localStorage.getItem(walletKey(name));
  if (!raw)
    throw new Error(`Carteira de ${name} não encontrada neste navegador.`);
  const value = JSON.parse(raw);
  if (
    !value ||
    !Number.isSafeInteger(value.balance) ||
    value.balance < 0 ||
    typeof value.lastClaim !== "string" ||
    !Array.isArray(value.predictions) ||
    !value.predictions.every(isPrediction) ||
    (value.transactions !== undefined &&
      (!Array.isArray(value.transactions) ||
        !value.transactions.every(isWalletTransaction)))
  )
    throw new Error(`A carteira de ${name} contém dados inválidos.`);
  return { ...value, transactions: value.transactions ?? [] };
}
export function writeWalletStrict(name: string, wallet: Wallet) {
  localStorage.setItem(walletKey(name), JSON.stringify(wallet));
}
