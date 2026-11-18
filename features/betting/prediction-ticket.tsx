"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useDemoSession } from "@/features/auth/session-context";
import { formatBalance } from "@/features/wallet/wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { Selection } from "@/features/betting/types";

export function PredictionTicket({
  selection,
  onClose,
  onReturnFocus,
}: {
  selection: Selection;
  onClose: () => void;
  onReturnFocus: () => void;
}) {
  const { balance, placePrediction } = useDemoSession();
  const [amount, setAmount] = useState("");
  const stake = Number(amount);
  const validStake = Number.isSafeInteger(stake) && stake >= 1 && stake <= balance;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <DialogTitle>Confirmar aposta</DialogTitle>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!validStake) return;
            placePrediction({ ...selection, stake });
            toast.success("Aposta registrada.");
            onClose();
          }}
        >
          <Field>
            {selection.market}
            <Input value={selection.outcome} readOnly />
          </Field>
          <Field>
            Valor em Croins
            <Input
              autoFocus
              type="number"
              min="1"
              max={balance}
              step="1"
              required
              value={amount}
              placeholder={`Saldo: ${formatBalance.format(balance)} Croins`}
              onChange={(event) => setAmount(event.currentTarget.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Valores rápidos">
            {[10, 25, 50, 100].map((value) => (
              <Button key={value} variant={stake === value ? "outline" : "secondary"} size="sm" disabled={value > balance} aria-pressed={stake === value} onClick={() => setAmount(String(value))}>
                {value} Croins
              </Button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!validStake}>
              Confirmar aposta
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
