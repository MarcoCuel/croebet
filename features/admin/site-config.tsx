"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { requireLocalAdmin } from "@/features/betting/betting-storage";
import { useDemoSession } from "@/features/auth/session-context";
import {
  announceDemoData,
  demoDataEvent,
  withDemoLock,
} from "@/lib/demo-storage";
import {
  initialSiteConfig,
  readSiteConfig,
  writeSiteConfig,
  type SiteConfig,
} from "@/features/admin/site-storage";
export type {
  AdminGame,
  AdminMarket,
  SiteConfig,
} from "@/features/admin/site-storage";

const SiteContext = createContext<{
  config: SiteConfig;
  ready: boolean;
  revision: number;
  error: string | null;
  save: (next: SiteConfig) => Promise<boolean>;
} | null>(null);
export function SiteConfigProvider({ children }: { children: ReactNode }) {
  const { permissions } = useDemoSession();
  const [state, setState] = useState({
    config: initialSiteConfig,
    ready: false,
    revision: 0,
    error: null as string | null,
  });
  useEffect(() => {
    function refresh() {
      try {
        const config = readSiteConfig();
        setState((s) => ({
          config,
          ready: true,
          revision: s.revision + 1,
          error: null,
        }));
      } catch (error) {
        setState((s) => ({
          ...s,
          ready: true,
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível ler os dados locais.",
        }));
      }
    }
    refresh();
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener(demoDataEvent, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(demoDataEvent, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  async function save(next: SiteConfig) {
    if (!permissions.canManageSite || !state.ready || state.error) return false;
    try {
      await withDemoLock(() => {
        requireLocalAdmin();
        const current = readSiteConfig();
        // Market changes go through lifecycle services, never generic content saves.
        writeSiteConfig({ ...next, markets: current.markets });
        announceDemoData();
      });
      toast.success("Alterações salvas.");
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as alterações.",
      );
      return false;
    }
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
