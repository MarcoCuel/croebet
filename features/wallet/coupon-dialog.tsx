"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

export function CouponDialog() {
  return (
    <DialogContent aria-describedby={undefined}>
      <DialogTitle>Resgatar cupom</DialogTitle>
      <form
        className="mt-5 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const field = event.currentTarget.elements.namedItem(
            "coupon",
          ) as HTMLInputElement;
          if (!field.value.trim()) {
            field.setCustomValidity("Digite o código do cupom.");
            field.reportValidity();
            return;
          }
          toast.info("O resgate de cupons ainda não está disponível.");
        }}
      >
        <Field>
          Código do cupom
          <Input
            name="coupon"
            placeholder="Digite seu cupom"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            onInput={(event) => event.currentTarget.setCustomValidity("")}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </DialogClose>
          <Button type="submit">Resgatar cupom</Button>
        </div>
      </form>
    </DialogContent>
  );
}
