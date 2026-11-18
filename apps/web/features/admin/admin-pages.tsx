"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { useSiteConfig } from "@/features/admin/site-config";
import { validPageSlug } from "@/features/pages/content";
import { richTextPlainText, type RichTextDocument } from "@/lib/rich-text";

export function AdminPages() {
  const { config } = useSiteConfig();
  const pages = config.pages;
  return <div className="grid gap-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {pages.map((page) => <Card key={page.slug} className="flex flex-col items-start gap-4">
        <div className="w-full min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 break-words font-semibold">{page.title}</h2>
            <Badge variant={page.published ? "default" : "secondary"} className="shrink-0">
              {page.published ? "Publicada" : "Rascunho"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted">/{page.slug}</p>
        </div>
        <div className="mt-auto flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm"><Link href={`/admin/paginas/${page.slug}`} aria-label={`Editar ${page.title}`}>Editar</Link></Button>
          {page.published && <Button asChild variant="ghost" size="sm"><Link href={`/${page.slug}`} aria-label={`Ver ${page.title}`}>Ver página</Link></Button>}
        </div>
      </Card>)}
    </div>
  </div>;
}

export function AdminPageEditor({ slug }: { slug: string }) {
  const { config, save } = useSiteConfig();
  const router = useRouter();
  const page = config.pages.find((p) => p.slug === slug);
  const isNew = slug === "nova";
  const [document, setDocument] = useState<RichTextDocument>(() => page?.document ?? []);
  const [saving, setSaving] = useState(false);
  if (!isNew && !page) notFound();
  return <Card>
    <form className="grid gap-5" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const title = String(form.get("title") ?? "").trim();
      const nextSlug = String(form.get("slug") ?? "").trim();
      const published = form.get("published") === "on";
      if (!title || !validPageSlug(nextSlug)) {
        toast.error("Informe um título e um endereço válido com letras minúsculas, números e hífens, sem usar uma rota existente.");
        return;
      }
      if (config.pages.some((p) => p.slug === nextSlug && (isNew || p.slug !== slug))) {
        toast.error("Já existe uma página com esse endereço.");
        return;
      }
      if (published && !richTextPlainText(document).trim()) {
        toast.error("Escreva o conteúdo da página antes de publicar.");
        return;
      }
      const next = { title, slug: nextSlug, document, published, showInMenu: form.get("showInMenu") === "on" };
      setSaving(true);
      try {
        if (await save({ ...config, pages: isNew ? [...config.pages, next] : config.pages.map((p) => p.slug === slug ? next : p) })) router.push("/admin/paginas");
      } finally { setSaving(false); }
    }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>Título<Input name="title" defaultValue={page?.title} required maxLength={100} /></Field>
        <Field>Slug<Input name="slug" defaultValue={page?.slug} required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="nome-da-pagina" /></Field>
      </div>
      <RichTextEditor label={`Conteúdo da página ${page?.title ?? "nova"}`} initialValue={document} onChange={setDocument} />
      <Field className="flex items-center justify-between">Publicar página<Switch name="published" defaultChecked={page?.published ?? false} /></Field>
      <Field className="flex items-center justify-between">Mostrar no menu principal<Switch name="showInMenu" defaultChecked={page?.showInMenu ?? false} /></Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={saving}>Salvar página</Button>
        <Button asChild variant="secondary"><Link href="/admin/paginas">Cancelar</Link></Button>
      </div>
    </form>
  </Card>;
}
