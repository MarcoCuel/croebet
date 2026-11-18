"use client";

import type { ReactNode } from "react";
import { SiteConfigProvider } from "@/features/admin/site-config";
import { DemoSessionProvider } from "@/features/auth/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider, useTheme } from "@/features/theme/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AppProviders>{children}</AppProviders>
    </ThemeProvider>
  );
}

function AppProviders({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <TooltipProvider delayDuration={300}>
      <DemoSessionProvider>
        <SiteConfigProvider>{children}</SiteConfigProvider>
        <Toaster theme={resolvedTheme} />
      </DemoSessionProvider>
    </TooltipProvider>
  );
}
