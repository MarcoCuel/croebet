import { navigationSchema } from "@croebet/shared";
export async function loadNavigation(base: string, request: typeof fetch = fetch) {
  try {
    const response = await request(`${base}/api/v1/navigation`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000) });
    return response.ok ? navigationSchema.parse(await response.json()) : null;
  } catch { return null; }
}
