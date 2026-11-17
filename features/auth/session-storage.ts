import {
  initialWallet,
  isPrediction,
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
          return value as Wallet;
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
