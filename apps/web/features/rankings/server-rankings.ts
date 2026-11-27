import "server-only";
import { cookies } from "next/headers";
import { rankingSchema, type RankingQuery } from "@croebet/shared";

export async function getRanking(query: RankingQuery) {
  const jar = await cookies();
  const session = jar.get("__Host-croebet-session") ?? jar.get("croebet-session");
  const params = new URLSearchParams({ category: query.category, period: query.period, page: String(query.page) });
  if (query.game) params.set("game", query.game);
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"}/api/v1/rankings?${params}`, {
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
      headers: session ? { cookie: `${session.name}=${encodeURIComponent(session.value)}` } : {},
    });
    return response.ok ? rankingSchema.parse(await response.json()) : null;
  } catch { return null; }
}
