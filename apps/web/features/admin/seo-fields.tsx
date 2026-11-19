"use client";
import type { SeoFields } from "@croebet/shared";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
export function SeoInputs({ value, onChange }: { value: SeoFields; onChange: (value: SeoFields) => void }) {
  return <div className="grid gap-4">
    <Field>Título SEO<Input value={value.title} maxLength={160} placeholder="Usar título padrão" onChange={e => onChange({ ...value, title: e.target.value })} /></Field>
    <Field>Descrição<Input value={value.description} maxLength={500} placeholder="Usar descrição padrão" onChange={e => onChange({ ...value, description: e.target.value })} /></Field>
    <Field>Imagem de compartilhamento<Input value={value.image} maxLength={2048} placeholder="URL HTTPS ou /imagem.webp" onChange={e => onChange({ ...value, image: e.target.value })} /></Field>
    <Field>Texto alternativo<Input value={value.imageAlt} maxLength={200} onChange={e => onChange({ ...value, imageAlt: e.target.value })} /></Field>
    <label className="flex items-center gap-2 text-sm"><Switch checked={value.index} onCheckedChange={index => onChange({ ...value, index })} />Permitir indexação</label>
  </div>;
}
export function SeoEditor(props: Parameters<typeof SeoInputs>[0]) {
  return <details className="mt-5 rounded-panel border border-foreground/6 p-5"><summary className="cursor-pointer text-sm font-medium">SEO</summary><p className="my-4 text-sm text-muted">Deixe os campos vazios para usar os padrões do site.</p><SeoInputs {...props} /></details>;
}
