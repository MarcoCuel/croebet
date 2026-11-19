import { dailyStatusSchema, economySchema } from "@croebet/shared";

export async function loadEconomy(base = "", request: typeof fetch = fetch) {
  try {
    const response = await request(`${base}/api/v1/economy`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000) });
    return response.ok ? economySchema.parse(await response.json()) : null;
  } catch { return null; }
}
export async function loadDailyStatus(base = "", cookie?: string, request: typeof fetch = fetch) {
  try {
    const response = await request(`${base}/api/v1/rewards/daily`, {
      headers: cookie ? { cookie } : undefined, cache: "no-store", credentials: "same-origin", redirect: "error", signal: AbortSignal.timeout(3000),
    });
    return response.ok ? dailyStatusSchema.parse(await response.json()) : null;
  } catch { return null; }
}
export async function requestDailyClaim(requestId: string) {
  const csrf = await fetch("/api/v1/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  if (!csrf.ok) throw new Error("Não foi possível conectar. Tente novamente.");
  const { token } = await csrf.json();
  const response = await fetch("/api/v1/rewards/daily/claim", {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "Content-Type": "application/json", "x-csrf-token": token }, body: JSON.stringify({ requestId }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error?.message ?? "Não foi possível resgatar. Tente novamente.");
  }
  return dailyStatusSchema.parse(await response.json());
}
