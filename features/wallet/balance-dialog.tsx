"use client";

import { CoinsIcon } from "@phosphor-icons/react/dist/csr/Coins";
import { toast } from "sonner";
import { useDemoSession } from "@/features/auth/session-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBalance } from "./wallet";

export function BalanceDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const { username, balance, addBalance } = useDemoSession();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <CoinsIcon
          className="mb-3 size-7 text-accent"
          weight="fill"
          aria-hidden="true"
        />
        <DialogTitle>Saldo de Croins</DialogTitle>
        <DialogDescription>
          {formatBalance.format(balance)} {balance === 1 ? "Croin" : "Croins"} ·
          saldo fictício de demonstração
        </DialogDescription>
        <form
          className="mt-5 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const amount = Number(
              new FormData(event.currentTarget).get("amount"),
            );
            if (
              !username ||
              !Number.isSafeInteger(amount) ||
              amount < 1 ||
              amount > 999999 ||
              !Number.isSafeInteger(balance + amount)
            )
              return;
            addBalance(amount);
            onOpenChange(false);
            toast.success("Croins de teste adicionados.");
          }}
        >
          <Field>
            Adicionar Croins de teste
            <Input
              type="number"
              name="amount"
              min="1"
              max="999999"
              step="1"
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancelar</Button>
            </DialogClose>
            <Button type="submit">Adicionar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
