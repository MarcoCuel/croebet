import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function PageShell({
  className,
  ...props
}: ComponentProps<"main"> & {}) {
  return (
    <main
      className={cn(
        "mx-auto w-[calc(100%-2*var(--page-gap))] flex-1",
        className,
      )}
      {...props}
    />
  );
}
