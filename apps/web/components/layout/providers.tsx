"use client";

import type { InitialSession } from "@/features/auth/initial-session";
import type { ReactNode } from "react";
import { SiteConfigProvider } from "@/features/admin/site-config";
import { DemoSessionProvider } from "@/features/auth/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/features/theme/theme-provider";

type ProvidersProps = { children: ReactNode; initialSession: InitialSession };

export function Providers({ children, initialSession }: ProvidersProps) {
  return (
    <ThemeProvider>
      <AppProviders initialSession={initialSession}>{children}</AppProviders>
    </ThemeProvider>
  );
}

function AppProviders({ children, initialSession }: ProvidersProps) {
  const { resolvedTheme } = useTheme();
  return (
    <TooltipProvider delayDuration={300}>
      <DemoSessionProvider initialSession={initialSession}>
        <SiteConfigProvider>{children}</SiteConfigProvider>
        <Toaster theme={resolvedTheme} />
      </DemoSessionProvider>
    </TooltipProvider>
  );
}
