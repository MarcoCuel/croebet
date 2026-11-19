import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { matchCodeSchema, matchSchema, matchListSchema, type Match } from "@croebet/shared";

export type InitialMatches = { revision: string; match: Match | null; items: Match[]; error: string; unavailable: boolean };
export async function getInitialMatches(code: string | undefined): Promise<InitialMatches> {
  const empty: InitialMatches = { revision: randomUUID(), match: null, items: [], error: "", unavailable: false };
  const jar = await cookies();
  const cookie = jar.get("__Host-croebet-session") ?? jar.get("croebet-session");
  if (!cookie) return { ...empty, error: code ? "Entre na conta que iniciou esta partida." : "" };
  if (code && !matchCodeSchema.safeParse(code).success) return { ...empty, error: "Partida não encontrada." };
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"}/api/v1/matches${code ? `/${code}` : ""}`, {
      headers: { cookie: `${cookie.name}=${encodeURIComponent(cookie.value)}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    });
    if (response.status === 401) return { ...empty, error: "Entre novamente para consultar suas partidas." };
    if (response.status === 404) return { ...empty, error: "Partida não encontrada." };
    if (!response.ok) throw new Error("unavailable");
    const data: unknown = await response.json();
    return code ? { ...empty, match: matchSchema.parse(data) } : { ...empty, items: matchListSchema.parse(data).items };
  } catch { return { ...empty, unavailable: true, error: "Não foi possível carregar suas partidas." }; }
}
