"use client";

import type { ReactNode } from "react";
import { DemoSessionProvider } from "@/features/auth/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/features/theme/theme-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
    <TooltipProvider delayDuration={300}>
      <DemoSessionProvider>
        {children}
        <Toaster />
      </DemoSessionProvider>
    </TooltipProvider>
    </ThemeProvider>
  );
}
