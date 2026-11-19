import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { loadEconomy, loadDailyStatus } from "@/features/wallet/economy-api";
import { loadInitialSession } from "./initial-session";

export const getInitialSession = cache(async () => {
  const cookieStore = await cookies();
  const session = cookieStore.get("__Host-croebet-session") ?? cookieStore.get("croebet-session");
  const cookie = session ? `${session.name}=${encodeURIComponent(session.value)}` : undefined;
  const base = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001";
  const [initial, economy] = await Promise.all([loadInitialSession(cookie, base), loadEconomy(base)]);
  const daily = initial.user ? await loadDailyStatus(base, cookie) : null;
  return { ...initial, economy, daily };
});
