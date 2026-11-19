import type { MetadataRoute } from "next";
import { siteOrigin } from "@/features/seo/metadata";
import { seoPathsSchema } from "@croebet/shared";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"}/api/v1/seo/paths`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (response.ok) return seoPathsSchema.parse(await response.json()).paths.map(path => ({ url: new URL(path, siteOrigin()).href }));
  } catch { /* Omit URLs when availability cannot be verified. */ }
  return [];
}
