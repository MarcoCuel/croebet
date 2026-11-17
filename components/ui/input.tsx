import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "min-h-11 w-full min-w-0 rounded-lg border-(length:--border-width-hairline) border-field-border bg-background px-3 py-2 text-base font-normal text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
