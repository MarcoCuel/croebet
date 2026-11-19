"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CouponDialog } from "@/features/wallet/coupon-dialog";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

export function RedeemButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" aria-label="Resgatar cupom">
          Resgatar
        </Button>
      </DialogTrigger>
      <CouponDialog onRedeemed={() => setOpen(false)} />
    </Dialog>
  );
}
