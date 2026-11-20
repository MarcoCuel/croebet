"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { commandResultSchema, type AdminUser } from "@croebet/shared";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSession } from "@/features/auth/session-context";
import { managementRequest } from "./management-api";
import { adminDate } from "./management-shared";

export function AdminUserDelete({ user }: { user: AdminUser }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { userId: currentUserId, refreshAccount } = useSession();
  if (user.deletionScheduledAt) return <p className="text-sm text-muted">Exclusão permanente em {adminDate(user.deletionScheduledAt)}. Reative a conta pelo status para cancelar.</p>;
  return <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}>
    <DialogTrigger asChild><Button variant="outline" size="sm">Excluir conta</Button></DialogTrigger>
    <DialogContent aria-describedby={undefined}>
      <DialogTitle>Excluir conta</DialogTitle>
      <p className="my-5 text-sm text-muted">A conta de @{user.username} ficará inativa imediatamente e será excluída permanentemente após 30 dias. Você pode cancelar a exclusão reativando a conta nesse período. Os históricos de partidas e movimentações serão preservados.</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancelar</Button>
        <Button loading={pending} onClick={async () => {
          if (pending) return;
          setPending(true);
          try {
            await managementRequest(`/admin/users/${user.id}`, commandResultSchema, "DELETE", {});
            setOpen(false);
            toast.success("Conta inativada. Exclusão agendada para daqui a 30 dias.");
            if (currentUserId === user.id) { await refreshAccount(); router.replace("/"); }
            else router.refresh();
          } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir a conta."); }
          finally { setPending(false); }
        }}>Excluir conta</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
