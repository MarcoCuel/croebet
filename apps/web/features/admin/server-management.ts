import "server-only";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

export async function getManagement<T>(path: string, schema: { parse: (value: unknown) => T }): Promise<T | null> {
  const store = await cookies();
  const cookie = store.get("__Host-croebet-session") ?? store.get("croebet-session");
  if (!cookie) notFound();
  let response: Response;
  try {
    response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"}/api/v1${path}`, {
      headers: { cookie: `${cookie.name}=${encodeURIComponent(cookie.value)}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    });
  } catch { return null; }
  if (response.status === 401 || response.status === 404) notFound();
  if (!response.ok) return null;
  try { return schema.parse(await response.json()); } catch { return null; }
}
