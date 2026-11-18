import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export function Card({
  className,
  asChild = false,
  ...props
}: ComponentProps<"div"> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "div";
  return (
    <Component
      data-slot="card"
      className={cn("rounded-panel bg-surface p-5 sm:p-6", className)}
      {...props}
    />
  );
}
