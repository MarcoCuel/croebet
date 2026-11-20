"use client";

import type { ReactNode } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

/** Label/value row with a controlled edit dialog; forms stay with their feature. */
export function EditableRow({ label, value, children, open, onOpenChange }: {
  label: string;
  value: ReactNode;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-contrast/6 py-3 last:border-0">
      <span className="shrink-0 text-sm">{label}</span>
      <div className="flex min-h-9 min-w-0 items-center gap-2">
        <span className="truncate text-sm text-muted">{value}</span>
        {children && <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${label.toLocaleLowerCase("pt-BR")}`}>
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>{children}</DialogContent>
        </Dialog>}
      </div>
    </div>
  );
}
