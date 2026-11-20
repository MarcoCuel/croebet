"use client";

import { useState } from "react";
import { toast } from "sonner";
import { seoSettingsSchema, type SeoFields, type SeoSettings } from "@croebet/shared";
import { EditableRow } from "@/components/shared/editable-row";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { managementRequest } from "./management-api";

type SettingsField = keyof SeoFields | "siteName" | "titleTemplate";
const seoFields = [
  { field: "title", label: "Título SEO", maxLength: 160 },
  { field: "description", label: "Descrição", maxLength: 500 },
  { field: "image", label: "Imagem de compartilhamento", maxLength: 2048, placeholder: "URL HTTPS ou /imagem.webp" },
  { field: "imageAlt", label: "Texto alternativo", maxLength: 200 },
  { field: "index", label: "Permitir indexação" },
] as const;

function SettingsRow({ field, label, value, maxLength, placeholder, inherited = false, onSave }: {
  field: SettingsField;
  label: string;
  value: string | boolean;
  maxLength?: number;
  placeholder?: string;
  inherited?: boolean;
  onSave: (value: string | boolean) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState(false);
  return <EditableRow label={label} value={typeof value === "boolean" ? value ? "Sim" : "Não" : value || (inherited ? "Usar padrão do site" : "Não definido")} open={open} onOpenChange={next => {
    if (pending) return;
    if (next) setDraft(value);
    setOpen(next);
  }}>
    <DialogTitle>Editar {label.toLocaleLowerCase("pt-BR")}</DialogTitle>
    <form className="mt-5 grid gap-4" onSubmit={async event => {
      event.preventDefault();
      if (pending) return;
      setPending(true);
      try { if (await onSave(draft)) setOpen(false); }
      finally { setPending(false); }
    }}>
      {typeof draft === "boolean"
        ? <label className="flex items-center gap-2 text-sm"><Switch checked={draft} disabled={pending} onCheckedChange={setDraft} />{label}</label>
        : <Field>{label}<Input value={draft} onChange={event => setDraft(event.target.value)} required={field === "siteName" || field === "titleTemplate"} maxLength={maxLength} placeholder={placeholder} disabled={pending} /></Field>}
      <Button type="submit" loading={pending}>Salvar alterações</Button>
    </form>
  </EditableRow>;
}

export function AdminSeo({ initial }: { initial: SeoSettings }) {
  const [value, setValue] = useState(initial);
  async function save(next: SeoSettings) {
    const parsed = seoSettingsSchema.safeParse(next);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return false; }
    try {
      setValue(await managementRequest("/admin/seo", seoSettingsSchema, "PATCH", parsed.data));
      toast.success("Configurações salvas.");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
      return false;
    }
  }
  return <div className="grid min-w-0 gap-5">
    <h1 className="sr-only">Configurações</h1>
    <Card className="min-w-0"><h2 className="mb-2 font-semibold">Padrões do site</h2>
      <div>
        <SettingsRow field="siteName" label="Nome do site" value={value.siteName} maxLength={80} onSave={siteName => save({ ...value, siteName: String(siteName) })} />
        <SettingsRow field="titleTemplate" label="Formato dos títulos" value={value.titleTemplate} maxLength={200} placeholder="{título} · Croebet" onSave={titleTemplate => save({ ...value, titleTemplate: String(titleTemplate) })} />
        {seoFields.map(props => <SettingsRow key={props.field} {...props} value={value[props.field]} onSave={next => save({ ...value, [props.field]: next })} />)}
      </div>
      <p className="mt-4 text-sm text-muted">Use {'{título}'} para o nome da página. Exemplo: Jogos · Croebet.</p>
      <p className="mt-2 text-sm text-muted">Desenvolvimento e teste permanecem fora da indexação.</p>
    </Card>
    {([['home', 'Página inicial'], ['games', 'Listagem de jogos']] as const).map(([key, label]) => <Card key={key} className="min-w-0">
      <h2 className="font-semibold">{label}</h2>
      <p className="mb-2 mt-2 text-sm text-muted">Opcional. Campos vazios usam os padrões do site.</p>
      <div>{seoFields.map(props => <SettingsRow key={props.field} {...props} inherited value={value[key][props.field]} onSave={next => save({ ...value, [key]: { ...value[key], [props.field]: next } })} />)}</div>
    </Card>)}
    <Card className="grid min-w-0 gap-2"><p className="text-xs text-muted">Prévia dos padrões</p><p className="break-words text-lg font-medium">{value.title}</p><p className="break-words text-sm text-muted">{value.description}</p>{value.image && <div className="mt-3 aspect-[1.91] max-w-lg rounded-panel bg-cover bg-center bg-no-repeat" role="img" aria-label={value.imageAlt || "Imagem de compartilhamento"} style={{ backgroundImage: `url(${JSON.stringify(value.image)})` }} />}</Card>
  </div>;
}
