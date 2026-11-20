import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function PageShell({
  className,
  inner = true,
  ...props
}: ComponentProps<"main"> & { inner?: boolean }) {
  return (
    <main
      className={cn(
        "mx-auto w-[calc(100%-2*var(--page-gap))] flex-1",
        inner && "pt-2",
        className,
      )}
      {...props}
    />
  );
}
