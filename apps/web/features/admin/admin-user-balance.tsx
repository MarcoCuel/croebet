"use client";
import { EditableRow } from "@/components/shared/editable-row";
import { Balance, BalanceValue } from "@/features/wallet/balance";
import { randomUUID } from "@/lib/uuid";

import { commandResultSchema } from "@croebet/shared";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { balanceAdjustmentSchema } from "@croebet/shared";
import { managementRequest } from "@/features/admin/management-api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSession } from "@/features/auth/session-context";

export function AdminUserBalance({ userId, balance }: { userId: string; balance: number }) {
  const { permissions, refreshWallet } = useSession();
  const router = useRouter();
  const request = useRef<{ payload: string; id: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const direction = Number(value) < 0 ? "remove" : "add";
  const [pending, setPending] = useState(false);
  return (
    <EditableRow
      label="Saldo em Croins"
      value={<BalanceValue value={balance} />}
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (next) setValue("");
        setOpen(next);
      }}
    >
      <DialogTitle>Ajustar Croins</DialogTitle>
      <div className="my-5 rounded-xl bg-contrast/6 p-4" aria-label="Saldo atual em Croins">
        <div className="text-xl font-semibold"><Balance value={balance} /></div>
      </div>
      <form
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending || !permissions.canManageSite) return;
          const form = event.currentTarget;
          const fields = new FormData(form);
          const signedAmount = Number(fields.get("amount"));
          const amount = Math.abs(signedAmount);
          const direction = signedAmount < 0 ? "remove" : "add";
          const reason = String(fields.get("reason"));
          const payload = JSON.stringify([userId, direction, amount, reason]);
          if (request.current?.payload !== payload) request.current = { payload, id: randomUUID() };
          const input = balanceAdjustmentSchema.safeParse({ requestId: request.current.id, amount, direction, reason });
          if (!input.success) return void toast.error(input.error.issues[0].message);
          setPending(true);
          try {
            await managementRequest(`/admin/users/${userId}/adjustments`, commandResultSchema, "POST", input.data);
            request.current = null;
            await refreshWallet(); router.refresh();
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
            min={-Number.MAX_SAFE_INTEGER}
            max={Number.MAX_SAFE_INTEGER}
            step={1}
            required
            value={value}
            onChange={event => setValue(event.target.value)}
            disabled={pending}
          />
        </Field>
        <Field>Motivo (opcional)<Input name="reason" maxLength={256} disabled={pending} /></Field>
        <Button type="submit" loading={pending} disabled={pending || !Number.isSafeInteger(Number(value)) || Number(value) === 0}>
          {direction === "add" ? "Adicionar Croins" : "Retirar Croins"}
        </Button>
      </form>
    </EditableRow>
  );
}
