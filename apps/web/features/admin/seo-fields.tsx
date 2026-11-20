"use client";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ImagePicker } from "@/features/media/image-picker";
import type { SeoFields } from "@croebet/shared";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
export function SeoInputs({ value, onChange, form }: { value: SeoFields; onChange: (value: SeoFields) => void; form?: string }) {
  return <div className="grid gap-4">
    <Field>Título SEO<Input form={form} value={value.title} maxLength={160} placeholder="Usar título padrão" onChange={e => onChange({ ...value, title: e.target.value })} /></Field>
    <Field>Descrição<Input form={form} value={value.description} maxLength={500} placeholder="Usar descrição padrão" onChange={e => onChange({ ...value, description: e.target.value })} /></Field>
    <div className="grid gap-1.5"><p className="text-sm font-semibold">Imagem de compartilhamento</p><ImagePicker label="Imagem de compartilhamento" value={value.image} onChange={image => onChange({ ...value, image })} /></div>
    <Field>Texto alternativo<Input form={form} value={value.imageAlt} maxLength={200} onChange={e => onChange({ ...value, imageAlt: e.target.value })} /></Field>
    <label className="flex items-center gap-2 text-sm"><Switch form={form} checked={value.index} onCheckedChange={index => onChange({ ...value, index })} />Permitir indexação</label>
  </div>;
}
export function SeoEditor({ variant = "outline", disabled = false, ...props }: Parameters<typeof SeoInputs>[0] & { variant?: "outline" | "card"; disabled?: boolean }) {
  const content = <details className={variant === "card" ? "group" : "mt-5 rounded-panel border border-foreground/6 p-5"} inert={disabled}>
    <summary className={variant === "card" ? "flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold [&::-webkit-details-marker]:hidden" : "cursor-pointer text-sm font-medium"}>
      SEO{variant === "card" && <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />}
    </summary>
    <p className="my-4 text-sm text-muted">Deixe os campos vazios para usar os padrões do site.</p><SeoInputs {...props} />
  </details>;
  return variant === "card" ? <Card asChild>{content}</Card> : content;
}
