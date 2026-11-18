"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { isRichTextDocument, richTextPlainText } from "@/lib/rich-text";
import { toast } from "sonner";
import { games } from "@/features/games/catalog";
import { markets, type Market } from "@/features/betting/markets";
import { defaultAbout, type AboutContent } from "@/features/about/content";

export type AdminGame = (typeof games)[number] & { enabled: boolean };
export type AdminMarket = Market & { enabled: boolean };
export type SiteConfig = {
  games: AdminGame[];
  markets: AdminMarket[];
  about: AboutContent;
};
const initial: SiteConfig = {
  games: games.map((game) => ({ ...game, enabled: true })),
  markets: markets.map((market) => ({ ...market, enabled: true })),
  about: defaultAbout,
};
const key = "croebet:demo-site-config:v1";

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
    data.markets.every(
      (m) =>
        m &&
        text(m.id) &&
        text(m.question) &&
        text(m.category) &&
        text(m.criterion) &&
        typeof m.enabled === "boolean" &&
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
                m.options[1] === "Não"))),
    ) &&
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

const SiteContext = createContext<{
  config: SiteConfig;
  ready: boolean;
  save: (next: SiteConfig) => boolean;
} | null>(null);
export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ config: initial, ready: false });
  useEffect(() => {
    let config = initial;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved: unknown = JSON.parse(raw);
        if (isSiteConfig(saved)) config = saved;
      }
    } catch {
      /* Fall back to the original catalog if storage cannot be read. */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ config, ready: true });
  }, []);
  function save(next: SiteConfig) {
    if (!state.ready || !isSiteConfig(next)) {
      toast.error("Revise os campos antes de salvar.");
      return false;
    }
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      toast.error("Não foi possível salvar as alterações neste navegador.");
      return false;
    }
    setState({ config: next, ready: true });
    toast.success("Alterações salvas.");
    return true;
  }
  return (
    <SiteContext.Provider value={{ ...state, save }}>
      {children}
    </SiteContext.Provider>
  );
}
export function useSiteConfig() {
  const context = useContext(SiteContext);
  if (!context) throw new Error("useSiteConfig requires SiteConfigProvider");
  return context;
}
