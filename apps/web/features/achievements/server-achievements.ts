import "server-only";
import { cookies } from "next/headers";
import { achievementsSchema } from "@croebet/shared";

export async function getOwnAchievements() {
  const jar = await cookies();
  const session = jar.get("__Host-croebet-session") ?? jar.get("croebet-session");
  if (!session) return { status: "unauthenticated" } as const;
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"}/api/v1/me/achievements`, {
      headers: { cookie: `${session.name}=${encodeURIComponent(session.value)}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    });
    if (response.status === 401) return { status: "unauthenticated" } as const;
    if (!response.ok) return { status: "unavailable" } as const;
    return { status: "ok", data: achievementsSchema.parse(await response.json()) } as const;
  } catch { return { status: "unavailable" } as const; }
}
