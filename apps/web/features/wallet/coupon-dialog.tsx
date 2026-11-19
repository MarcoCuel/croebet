"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { dailyStatusSchema, redeemCouponSchema } from "@croebet/shared";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DialogContent, DialogTitle } from "@/components/ui/dialog";
import { managementRequest } from "@/features/admin/management-api";
import { useDemoSession } from "@/features/auth/session-context";

export function CouponDialog({ onRedeemed }: { onRedeemed: () => void }) {
  const [pending, setPending] = useState(false);
  const request = useRef<{ code: string; id: string } | null>(null);
  const { refreshWallet } = useDemoSession();
  const router = useRouter();
  return <DialogContent aria-describedby={undefined}><DialogTitle>Resgatar cupom</DialogTitle>
    <form className="mt-5 grid gap-4" onSubmit={async event => {
      event.preventDefault(); if (pending) return;
      const code = String(new FormData(event.currentTarget).get("coupon")).trim().toUpperCase();
      if (request.current?.code !== code) request.current = { code, id: crypto.randomUUID() };
      const input = redeemCouponSchema.safeParse({ code, requestId: request.current.id });
      if (!input.success) return void toast.error(input.error.issues[0].message);
      setPending(true);
      try { await managementRequest("/coupons/redeem", dailyStatusSchema, "POST", input.data); request.current = null; await refreshWallet(); router.refresh(); toast.success("Cupom resgatado."); onRedeemed(); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível resgatar o cupom."); }
      finally { setPending(false); }
    }}>
      <Field>Código do cupom<Input name="coupon" placeholder="Digite seu cupom" autoComplete="off" autoCapitalize="characters" spellCheck={false} required minLength={3} maxLength={32} disabled={pending} /></Field>
      <Button type="submit" className="w-full" loading={pending}>Resgatar cupom</Button>
    </form>
  </DialogContent>;
}
