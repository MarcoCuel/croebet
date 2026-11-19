import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { gameSchema, gamesSchema } from "@croebet/shared";

export const getPublicGames = cache(async (slug?: string) => {
  let response: Response;
  try {
    response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"}/api/v1/games${slug ? `/${encodeURIComponent(slug)}` : ""}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
  } catch { return null; }
  if (response.status === 404 && slug) notFound();
  if (!response.ok) return null;
  try { return slug ? { items: [gameSchema.parse(await response.json())] } : gamesSchema.parse(await response.json()); } catch { return null; }
});
