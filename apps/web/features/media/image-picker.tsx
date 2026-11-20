"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MediaBrowser, MediaPreview } from "./media-browser";

export function ImagePicker({ value, onChange, label = "Imagem", disabled = false }: { value: string; onChange: (url: string) => void; label?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return <div className="grid gap-2">
    {value && <MediaPreview url={value} name={label} className="aspect-video w-full max-w-xs" />}
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>{value ? "Alterar imagem" : "Selecionar imagem"}</Button>
      {value && <Button type="button" variant="ghost" disabled={disabled} onClick={() => onChange("")}>Remover imagem</Button>}</div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent aria-describedby={undefined} className="flex h-[min(44rem,85dvh)] w-[min(64rem,calc(100%-2rem))] flex-col overflow-hidden" data-lenis-prevent>
      <DialogTitle>Selecionar imagem</DialogTitle>
      {open && <div className="mt-5 min-h-0 flex-1 overflow-y-auto" data-lenis-prevent><MediaBrowser onSelect={item => { onChange(item.url); setOpen(false); }} /></div>}
    </DialogContent></Dialog>
  </div>;
}
