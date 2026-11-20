"use client";
import { useState } from "react";
import { mediaDeleteResultSchema } from "@croebet/shared";
import { toast } from "sonner";
import type { MediaItem } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MediaBrowser, MediaPreview } from "@/features/media/media-browser";
import { managementRequest } from "./management-api";
export function AdminMedia() {
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  return <Card className="min-w-0"><h1 className="sr-only">Biblioteca de mídia</h1><MediaBrowser key={revision} onSelect={item => { setSelected(item); setConfirm(false); }} />
    <Dialog open={!!selected} onOpenChange={open => { if (!pending && !open) setSelected(null); }}><DialogContent aria-describedby={undefined} className="max-h-[85dvh] overflow-y-auto" data-lenis-prevent>
      <DialogTitle className="break-words">{selected?.name}</DialogTitle>
      {selected && <div className="mt-5 grid gap-4"><MediaPreview url={selected.url} name={selected.name} />
        <p className="text-sm text-muted">{selected.width} × {selected.height} · {Math.ceil(selected.bytes / 1024)} KB · {new Date(selected.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
        {confirm && <p className="text-sm">Excluir esta imagem permanentemente?</p>}
        <div className="flex flex-wrap gap-2"><Button variant="outline" loading={pending} onClick={async () => {
          if (!confirm) { setConfirm(true); return; }
          if (pending) return;
          setPending(true);
          try {
            await managementRequest(`/admin/media/${selected.id}`, mediaDeleteResultSchema, "DELETE");
            setSelected(null); setRevision(value => value + 1); toast.success("Imagem excluída.");
          } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir."); }
          finally { setPending(false); }
        }}>{confirm ? "Confirmar exclusão" : "Excluir imagem"}</Button>
        {confirm && <Button variant="ghost" disabled={pending} onClick={() => setConfirm(false)}>Cancelar</Button>}</div>
      </div>}
    </DialogContent></Dialog>
  </Card>;
}
