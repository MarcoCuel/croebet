import "server-only";
import { cache } from "react";
import type { Metadata } from "next";
import { defaultSeoSettings, seoSettingsSchema, type SeoFields } from "@croebet/shared";
export const getSeo = cache(async () => {
  try {
    const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"}/api/v1/seo`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (response.ok) return seoSettingsSchema.parse(await response.json());
  } catch { /* Keep safe defaults when the API is unavailable. */ }
  return defaultSeoSettings;
});
export const siteOrigin = () => process.env.WEB_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export async function publicMetadata(path: string, name?: string, fields?: SeoFields, generatedImage?: string): Promise<Metadata> {
  const settings = await getSeo();
  const custom = fields ?? (path === "/" ? settings.home : path === "/jogos" ? settings.games : undefined);
  const title = custom?.title ? (path === "/" ? custom.title : settings.titleTemplate.replaceAll("{título}", custom.title)) : name ? settings.titleTemplate.replaceAll("{título}", name) : settings.title;
  const description = custom?.description || settings.description;
  const image = custom?.image || generatedImage || settings.image;
  const alt = custom?.image ? custom.imageAlt : generatedImage ? `Jogar ${name} no ${settings.siteName}` : settings.imageAlt;
  const url = new URL(path, siteOrigin()).href;
  const images = image ? [{ url: new URL(image, siteOrigin()).href, alt }] : [];
  return { title, description, alternates: { canonical: url }, robots: { index: settings.index && (custom?.index ?? true), follow: true },
    openGraph: { title, description, url, siteName: settings.siteName, locale: "pt_BR", type: "website", images },
    twitter: { card: "summary_large_image", title, description, images } };
}
