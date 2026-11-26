"use client";

import { X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const contentVariants = cva(
  "fixed z-50 overflow-y-auto bg-surface text-foreground shadow-lg outline-none",
  {
    variants: {
      variant: {
        default:
          "top-1/2 left-1/2 max-h-[calc(100dvh-2rem)] w-[min(26rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-panel p-6 motion-safe:data-[state=open]:animate-dialog-in",
        drawer:
          "inset-y-0 left-0 h-dvh w-[min(19rem,calc(100%-2rem))] bg-background p-4 motion-safe:data-[state=open]:animate-drawer-in",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export function DialogContent({
  className,
  children,
  variant,
  showCloseButton = true,
  footer,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof contentVariants> & {
    showCloseButton?: boolean;
    footer?: ReactNode;
  }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm motion-safe:data-[state=open]:animate-dialog-overlay-in"
        data-lenis-prevent
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          contentVariants({ variant }),
          footer != null && "flex flex-col overflow-hidden p-0",
          className,
        )}
        data-lenis-prevent
        {...props}
      >
        {footer != null ? (
          <>
            <div
              data-slot="dialog-body"
              className="min-h-0 flex-1 overflow-y-auto p-6"
              data-lenis-prevent
            >
              {children}
            </div>
            <div
              data-slot="dialog-footer"
              className="shrink-0 border-t border-contrast/6 px-6 py-4"
            >
              {footer}
            </div>
          </>
        ) : (
          children
        )}
        {showCloseButton && (
          <DialogPrimitive.Close asChild>
            <Button
              variant="secondary"
              size="icon-sm"
              className="absolute top-3 right-3 z-10"
              aria-label="Fechar"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("pr-9 text-xl font-bold", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("mt-2 text-sm text-muted", className)}
      {...props}
    />
  );
}
