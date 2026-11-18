"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useDemoSession } from "@/features/auth/session-context";
import { adjustOwnLocalWallet } from "@/features/betting/betting-storage";

export function AdminUserBalance() {
  const { username, permissions } = useDemoSession();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [pending, setPending] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) setDirection("add");
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="mt-3">
          Ajustar Croins
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Ajustar Croins</DialogTitle>
        <div
          className="my-4 flex flex-wrap gap-1"
          role="group"
          aria-label="Tipo de ajuste"
        >
          <Button
            size="sm"
            variant={direction === "add" ? "secondary" : "ghost"}
            aria-pressed={direction === "add"}
            disabled={pending}
            onClick={() => setDirection("add")}
          >
            Adicionar
          </Button>
          <Button
            size="sm"
            variant={direction === "remove" ? "secondary" : "ghost"}
            aria-pressed={direction === "remove"}
            disabled={pending}
            onClick={() => setDirection("remove")}
          >
            Retirar
          </Button>
        </div>
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending || !permissions.canManageSite || !username) return;
            const form = event.currentTarget;
            const amount = Number(new FormData(form).get("amount"));
            setPending(true);
            try {
              await adjustOwnLocalWallet(username, amount, direction);
              form.reset();
              setOpen(false);
              toast.success(
                direction === "add"
                  ? "Croins adicionados."
                  : "Croins retirados.",
              );
            } catch (error) {
              toast.error(
                error instanceof Error
                  ? error.message
                  : "Não foi possível ajustar o saldo.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <Field className="min-w-0 flex-1">
            Valor em Croins
            <Input
              autoFocus
              name="amount"
              type="number"
              min={1}
              max={999999}
              step={1}
              required
              disabled={pending}
            />
          </Field>
          <Button type="submit" loading={pending} disabled={pending}>
            {direction === "add" ? "Adicionar Croins" : "Retirar Croins"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
