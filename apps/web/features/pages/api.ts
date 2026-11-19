import { pageLinksSchema, sitePageSchema, type SitePageRecord } from "@croebet/shared";
export async function loadPageLinks(base: string, request: typeof fetch = fetch) {
  try {
    const response = await request(`${base}/api/v1/pages`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000) });
    return response.ok ? pageLinksSchema.parse(await response.json()).items : null;
  } catch { return null; }
}
export async function loadPublicPage(base: string, slug: string, request: typeof fetch = fetch): Promise<{ status: "ready"; page: SitePageRecord } | { status: "not-found" | "unavailable" }> {
  try {
    const response = await request(`${base}/api/v1/pages/${encodeURIComponent(slug)}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000) });
    if (response.status === 404) return { status: "not-found" };
    if (!response.ok) return { status: "unavailable" };
    return { status: "ready", page: sitePageSchema.parse(await response.json()) };
  } catch { return { status: "unavailable" }; }
}
