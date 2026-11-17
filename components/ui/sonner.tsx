"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/features/theme/theme-provider";

export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme}
      position="bottom-right"
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-panel border-(length:--border-width-hairline) border-border bg-surface p-4 font-sans text-sm text-foreground shadow-lg",
          content: "flex-1",
          title: "font-semibold",
          description: "mt-1 text-muted",
          closeButton: "border-(length:--border-width-hairline) border-border bg-control text-foreground",
        },
      }}
      {...props}
    />
  );
}
