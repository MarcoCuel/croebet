"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { NavigationData } from "@croebet/shared";
import { useSession } from "@/features/auth/session-context";
import { loadNavigation } from "@/features/menus/api";

const MenuContext = createContext<NavigationData | null>(null);
export function MenuProvider({ initial, children }: { initial: NavigationData | null; children: ReactNode }) {
  const [update, setUpdate] = useState<{ source: NavigationData | null; data: NavigationData } | null>(null);
  const data = update?.source === initial ? update.data : initial;
  useEffect(() => {
    let active = true;
    const refresh = () => { void loadNavigation("").then(next => { if (active && next) setUpdate({ source: initial, data: next }); }); };
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [initial]);
  return <MenuContext.Provider value={data}>{children}</MenuContext.Provider>;
}
export function useMenus() {
  const menus = useContext(MenuContext);
  const { userId, sessionReady } = useSession();
  if (!menus || (sessionReady && userId)) return menus;
  const visible = (item: NavigationData["main"][number]) => item.fixed !== "achievements" && item.href.split(/[?#]/)[0] !== "/conquistas";
  return { main: menus.main.filter(visible), footer: menus.footer.filter(visible) };
}
