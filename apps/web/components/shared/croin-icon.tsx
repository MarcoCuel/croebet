import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function CroinIcon({ className, ...props }: ComponentProps<"span">) {
  return <span {...props} aria-hidden="true" className={cn("inline-grid size-6 shrink-0 place-items-center rounded-full bg-brand bg-(image:--background-image-primary-button) text-xs font-black text-white inset-shadow-primary-coin", className)}>C</span>;
}
