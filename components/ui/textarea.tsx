import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-28 w-full min-w-0 resize-y rounded-lg border border-field-border bg-background px-3 py-2 text-base text-foreground outline-none placeholder:text-muted focus-visible:border-accent disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
