import { isRichTextDocument, richTextPlainText } from "@/lib/rich-text";
import { games } from "@/features/games/catalog";
import {
  markets,
  marketStatuses,
  type Market,
} from "@/features/betting/markets";
import { isSettlement, validOutcome } from "@/features/betting/settlement";
import { defaultAbout, type AboutContent } from "@/features/about/content";

export function isMarket(value: unknown): value is Market {
  if (!value || typeof value !== "object") return false;
  const m = value as Market;
  const text = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  return (
    text(m.id) &&
    text(m.question) &&
    text(m.criterion) &&
    Object.hasOwn(marketStatuses, m.status) &&
    (m.endsAt === null ||
      (typeof m.endsAt === "string" &&
        Number.isFinite(Date.parse(m.endsAt)))) &&
    (m.type === "number"
      ? text(m.unit)
      : (m.type === "binary" || m.type === "choice") &&
        Array.isArray(m.options) &&
        m.options.length >= 2 &&
        m.options.every(text) &&
        new Set(m.options).size === m.options.length &&
        (m.type !== "binary" ||
          (m.options.length === 2 &&
            m.options[0] === "Sim" &&
            m.options[1] === "Não"))) &&
    (m.settlement === undefined
      ? !["resolved", "paid", "cancelled"].includes(m.status)
      : isSettlement(m.settlement) &&
        m.settlement.marketId === m.id &&
        ["resolved", "paid", "cancelled"].includes(m.status) &&
        (m.settlement.result === null
          ? m.settlement.kind === "refund" && m.status !== "paid"
          : validOutcome(m, m.settlement.result) && m.status !== "cancelled"))
  );
}
export type AdminGame = (typeof games)[number] & { enabled: boolean };
export type AdminMarket = Market;
export type SiteConfig = {
  games: AdminGame[];
  markets: AdminMarket[];
  about: AboutContent;
};
export const initialSiteConfig: SiteConfig = {
  games: games.map((game) => ({ ...game, enabled: true })),
  markets,
  about: defaultAbout,
};
export const siteConfigKey = "croebet:demo-site-config:v1";

export function isSiteConfig(value: unknown): value is SiteConfig {
  if (!value || typeof value !== "object") return false;
  const data = value as SiteConfig;
  const text = (value: unknown) =>
    typeof value === "string" && value.trim().length > 0;
  return (
    Array.isArray(data.games) &&
    data.games.length === games.length &&
    new Set(data.games.map((g) => g?.slug)).size === games.length &&
    data.games.every(
      (g) =>
        g &&
        games.some(
          (original) => original.slug === g.slug && original.cover === g.cover,
        ) &&
        text(g.name) &&
        text(g.type) &&
        text(g.description) &&
        Array.isArray(g.coverTitle) &&
        g.coverTitle.length > 0 &&
        g.coverTitle.every(text) &&
        typeof g.enabled === "boolean",
    ) &&
    Array.isArray(data.markets) &&
    new Set(data.markets.map((m) => m?.id)).size === data.markets.length &&
    data.markets.every(isMarket) &&
    !!data.about &&
    (data.about.document === undefined ||
      (isRichTextDocument(data.about.document) &&
        richTextPlainText(data.about.document).trim().length > 0)) &&
    text(data.about.title) &&
    text(data.about.intro) &&
    Array.isArray(data.about.sections) &&
    data.about.sections.length === defaultAbout.sections.length &&
    data.about.sections.every(
      (s) =>
        s &&
        text(s.title) &&
        Array.isArray(s.paragraphs) &&
        s.paragraphs.length > 0 &&
        s.paragraphs.every(text),
    )
  );
}

export function readSiteConfig(): SiteConfig {
  const raw = localStorage.getItem(siteConfigKey);
  if (!raw) return initialSiteConfig;
  const data = JSON.parse(raw);
  if (Array.isArray(data?.markets))
    data.markets = data.markets.map((m: Record<string, unknown>) => {
      const { category: _category, enabled, ...market } = m;
      void _category;
      let status = market.status ?? (enabled === false ? "paused" : "open");
      if (
        ["open", "paused"].includes(String(status)) &&
        typeof market.endsAt === "string" &&
        Date.parse(market.endsAt) <= Date.now()
      )
        status = "closed";
      return { ...market, status, endsAt: market.endsAt ?? null };
    });
  if (!isSiteConfig(data))
    throw new Error(
      "A configuração salva contém dados inválidos. Nenhum dado foi alterado.",
    );
  return data;
}
export function writeSiteConfig(config: SiteConfig) {
  if (!isSiteConfig(config))
    throw new Error("Revise os campos antes de salvar.");
  localStorage.setItem(siteConfigKey, JSON.stringify(config));
}
