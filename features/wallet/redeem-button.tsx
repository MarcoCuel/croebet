"use client";

import { Button } from "@/components/ui/button";
import { CouponDialog } from "@/features/wallet/coupon-dialog";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

export function RedeemButton() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" aria-label="Resgatar cupom">
          Resgatar
        </Button>
      </DialogTrigger>
      <CouponDialog />
    </Dialog>
  );
}
