"use client";

import dynamic from "next/dynamic";
import { ChevronDown, Shapes } from "lucide-react";
import { useState } from "react";
import type { IconName } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const LucideIcon = dynamic(() => import("@/components/ui/lucide-icon"));
const IconPickerGallery = dynamic(() => import("@/components/ui/icon-picker-gallery"), {
  loading: () => <p role="status" className="py-6 text-sm text-muted">Carregando ícones...</p>,
});

export function IconPicker({ value, onValueChange, disabled = false }: {
  value?: IconName | null;
  onValueChange: (value: IconName | null) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button variant="secondary" disabled={disabled} aria-label="Selecionar ícone" className="justify-start">
        {value ? <LucideIcon name={value} /> : <Shapes className="size-4" aria-hidden="true" />}
        <span className="min-w-0 truncate">{value ?? "Selecionar ícone"}</span>
        <ChevronDown className="ml-auto size-4" aria-hidden="true" />
      </Button>
    </DialogTrigger>
    <DialogContent className="grid w-[min(20rem,calc(100%-2rem))] gap-4 p-4" aria-describedby={undefined}>
      <DialogTitle className="text-base">Ícones Lucide</DialogTitle>
      {open && <IconPickerGallery value={value} onValueChange={icon => {
        onValueChange(icon);
        setOpen(false);
      }} />}
    </DialogContent>
  </Dialog>;
}
