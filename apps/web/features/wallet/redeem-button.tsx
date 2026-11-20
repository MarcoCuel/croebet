"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CouponDialog } from "@/features/wallet/coupon-dialog";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";

export function RedeemButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="size-8 p-0" aria-label="Resgatar cupom" title="Resgatar cupom">
          <Plus className="size-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <CouponDialog onRedeemed={() => setOpen(false)} />
    </Dialog>
  );
}
