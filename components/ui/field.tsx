import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Field({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      data-slot="field"
      className={cn("grid gap-1.5 text-sm font-semibold", className)}
      {...props}
    />
  );
}
