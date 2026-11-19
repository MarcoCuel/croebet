import "server-only";

import { cookies } from "next/headers";
import { transactionsSchema, walletSchema } from "@croebet/shared";

export async function getWalletHistory(direction: "all" | "income" | "expense") {
  const store = await cookies();
  const session = store.get("__Host-croebet-session") ?? store.get("croebet-session");
  if (!session) return { status: "signed-out" } as const;
  try {
    const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001";
    const options: RequestInit = {
      headers: { cookie: `${session.name}=${encodeURIComponent(session.value)}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    };
    const [wallet, history] = await Promise.all([
      fetch(`${base}/api/v1/me/wallet`, options),
      fetch(`${base}/api/v1/me/transactions?limit=20&direction=${direction}`, options),
    ]);
    if (wallet.status === 401 || history.status === 401) return { status: "signed-out" } as const;
    if (!wallet.ok || !history.ok) return { status: "unavailable" } as const;
    return { status: "ready", balance: walletSchema.parse(await wallet.json()).balance,
      history: transactionsSchema.parse(await history.json()) } as const;
  } catch {
    return { status: "unavailable" } as const;
  }
}
