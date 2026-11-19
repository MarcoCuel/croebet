"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { PageLink } from "@croebet/shared";
import { loadPageLinks } from "@/features/pages/api";
const LinksContext = createContext<PageLink[] | null>(null);
export function PageLinksProvider({ initial, children }: { initial: PageLink[] | null; children: ReactNode }) {
  const [update, setUpdate] = useState<{ source: PageLink[] | null; links: PageLink[] } | null>(null);
  const links = update?.source === initial ? update.links : initial;
  useEffect(() => {
    let active = true;
    const refresh = () => { void loadPageLinks("").then(next => { if (active && next) setUpdate({ source: initial, links: next }); }); };
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [initial]);
  return <LinksContext.Provider value={links}>{children}</LinksContext.Provider>;
}
export const usePageLinks = () => useContext(LinksContext);
