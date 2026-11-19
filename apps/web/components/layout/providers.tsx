"use client";

import type { InitialSession } from "@/features/auth/initial-session";
import type { ReactNode } from "react";
import { SiteConfigProvider } from "@/features/admin/site-config";
import { DemoSessionProvider } from "@/features/auth/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/features/theme/theme-provider";
import type { PageLink } from "@croebet/shared";
import { PageLinksProvider } from "@/features/pages/page-links";

type ProvidersProps = { children: ReactNode; initialSession: InitialSession; initialPages: PageLink[] | null };

export function Providers({ children, initialSession, initialPages }: ProvidersProps) {
  return (
    <ThemeProvider>
      <AppProviders initialSession={initialSession} initialPages={initialPages}>{children}</AppProviders>
    </ThemeProvider>
  );
}

function AppProviders({ children, initialSession, initialPages }: ProvidersProps) {
  const { resolvedTheme } = useTheme();
  return (
    <TooltipProvider delayDuration={300}>
      <DemoSessionProvider initialSession={initialSession}>
        <PageLinksProvider initial={initialPages}><SiteConfigProvider>{children}</SiteConfigProvider></PageLinksProvider>
        <Toaster theme={resolvedTheme} />
      </DemoSessionProvider>
    </TooltipProvider>
  );
}
