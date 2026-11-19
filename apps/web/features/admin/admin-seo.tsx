"use client";
import { useState } from "react";
import { toast } from "sonner";
import { seoSettingsSchema, type SeoSettings } from "@croebet/shared";
import { managementRequest } from "./management-api";
import { SeoInputs } from "./seo-fields";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
export function AdminSeo({ initial }: { initial: SeoSettings }) {
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  return <form className="grid gap-5" onSubmit={async e => {
    e.preventDefault(); if (pending) return;
    const parsed = seoSettingsSchema.safeParse(value);
    if (!parsed.success) return void toast.error(parsed.error.issues[0].message);
    setPending(true);
    try { setValue(await managementRequest("/admin/seo", seoSettingsSchema, "PATCH", parsed.data)); toast.success("SEO salvo."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setPending(false); }
  }}>
    <div className="flex items-center justify-between gap-4"><h1 className="text-xl font-semibold">SEO</h1><Button type="submit" loading={pending}>Salvar alterações</Button></div>
    <Card className="grid gap-5"><h2 className="font-medium">Padrões do site</h2>
      <Field>Nome do site<Input required value={value.siteName} maxLength={80} onChange={e => setValue({ ...value, siteName: e.target.value })} /></Field>
      <Field>Formato dos títulos<Input value={value.titleTemplate} maxLength={200} onChange={e => setValue({ ...value, titleTemplate: e.target.value })} /></Field>
      <p className="text-sm text-muted">Use {'{título}'} para o nome da página. Exemplo: Jogos · Croebet.</p>
      <SeoInputs value={value} onChange={fields => setValue({ ...value, ...fields })} />
      <p className="text-sm text-muted">Desenvolvimento e teste permanecem fora da indexação.</p>
    </Card>
    {([['home', 'Página inicial'], ['games', 'Listagem de jogos']] as const).map(([key, label]) => <Card key={key}><details><summary className="cursor-pointer font-medium">{label}</summary><p className="my-4 text-sm text-muted">Opcional. Campos vazios usam os padrões do site.</p><SeoInputs value={value[key]} onChange={fields => setValue({ ...value, [key]: fields })} /></details></Card>)}
    <Card className="grid gap-2"><p className="text-xs text-muted">Prévia dos padrões</p><p className="text-lg font-medium">{value.title}</p><p className="text-sm text-muted">{value.description}</p>{value.image && <div className="mt-3 aspect-[1.91] max-w-lg rounded-panel bg-cover bg-center bg-no-repeat" role="img" aria-label={value.imageAlt || "Imagem de compartilhamento"} style={{ backgroundImage: `url(${JSON.stringify(value.image)})` }} />}</Card>
  </form>;
}
