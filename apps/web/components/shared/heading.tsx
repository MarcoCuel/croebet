import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const headingVariants = cva("font-bold", {
  variants: {
    variant: {
      display: "text-display leading-tight tracking-display text-balance",
      section: "text-section leading-tight tracking-tight",
      banner: "text-banner leading-banner tracking-banner",
      cover: "text-cover leading-banner tracking-banner text-shadow-cover max-w-[70%]",
    },
  },
  defaultVariants: { variant: "section" },
});

export function Heading({
  className,
  variant,
  asChild = false,
  ...props
}: ComponentProps<"h2"> &
  VariantProps<typeof headingVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "h2";
  return (
    <Component
      className={cn(headingVariants({ variant }), className)}
      {...props}
    />
  );
}
