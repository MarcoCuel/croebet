"use client";

import type { InitialSession } from "@/features/auth/initial-session";
import type { ReactNode } from "react";
import { SiteConfigProvider } from "@/features/admin/site-config";
import { DemoSessionProvider } from "@/features/auth/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/features/theme/theme-provider";
import type { PageLink, NavigationData } from "@croebet/shared";
import { PageLinksProvider } from "@/features/pages/page-links";
import { MenuProvider } from "@/features/menus/menu-provider";

type ProvidersProps = { children: ReactNode; initialSession: InitialSession; initialPages: PageLink[] | null; initialNavigation: NavigationData | null };

export function Providers({ children, initialSession, initialPages, initialNavigation }: ProvidersProps) {
  return (
    <ThemeProvider>
      <AppProviders initialSession={initialSession} initialPages={initialPages} initialNavigation={initialNavigation}>{children}</AppProviders>
    </ThemeProvider>
  );
}

function AppProviders({ children, initialSession, initialPages, initialNavigation }: ProvidersProps) {
  const { resolvedTheme } = useTheme();
  return (
    <TooltipProvider delayDuration={300}>
      <DemoSessionProvider initialSession={initialSession}>
        <MenuProvider initial={initialNavigation}><PageLinksProvider initial={initialPages}><SiteConfigProvider>{children}</SiteConfigProvider></PageLinksProvider></MenuProvider>
        <Toaster theme={resolvedTheme} />
      </DemoSessionProvider>
    </TooltipProvider>
  );
}
