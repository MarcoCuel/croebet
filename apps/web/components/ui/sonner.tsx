"use client";

import { X } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      position="bottom-center"
      closeButton
      icons={{ close: <X aria-hidden className="size-5" /> }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: "Fechar notificação",
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-panel border-(length:--border-width-hairline) border-contrast/6 bg-surface p-4 font-sans text-sm text-foreground shadow-lg",
          content: "min-w-0 flex-1",
          icon: "shrink-0 text-brand",
          title: "font-semibold",
          description: "mt-1 text-muted",
          closeButton:
            "order-last flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm border-(length:--border-width-hairline) border-transparent! bg-transparent! p-0 text-muted! shadow-none! outline-none hover:text-foreground! focus-visible:border-contrast/6!",
        },
      }}
      {...props}
    />
  );
}
