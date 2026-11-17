import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-w-0 shrink-0 cursor-pointer items-center justify-center gap-2 border-(length:--border-width-hairline) border-transparent text-center font-semibold outline-none transition-colors focus-visible:border-foreground active:brightness-90 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-brand bg-(image:--background-image-primary-button) text-white inset-shadow-primary-button hover:bg-brand-hover",
        secondary: "bg-control text-foreground hover:bg-control-hover",
        outline:
          "border-field-border bg-transparent text-foreground hover:bg-control",
        ghost:
          "bg-transparent text-muted hover:bg-control-hover hover:text-foreground",
        destructive: "bg-destructive text-white hover:bg-destructive-hover",
        link: "h-auto rounded-sm bg-transparent p-0 text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 rounded-panel px-4 py-2 text-sm",
        sm: "min-h-8 rounded-xl px-3 py-1 text-xs",
        lg: "min-h-12 rounded-panel px-6 py-2 text-base",
        icon: "size-11 rounded-panel p-0",
        "icon-sm": "size-9 rounded-lg p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> &
  (
    | { asChild: true; loading?: never; disabled?: never }
    | { asChild?: false; loading?: boolean }
  );

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : type}
      disabled={asChild ? undefined : disabled || loading}
      aria-disabled={asChild && (disabled || loading) ? true : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && (
            <LoaderCircle
              className="size-4 motion-safe:animate-spin"
              aria-hidden="true"
            />
          )}
          {children}
        </>
      )}
    </Component>
  );
}
