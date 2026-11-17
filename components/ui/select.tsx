import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Native selection for short lists, with the platform's field styling. */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative inline-flex min-w-0">
      <select
        data-slot="select"
        className={cn(
          "min-h-11 w-full appearance-none rounded-lg border border-field-border bg-surface py-2 pr-9 pl-3 text-sm text-foreground outline-none focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
    </span>
  );
}
