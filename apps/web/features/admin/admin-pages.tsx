"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { pageWriteSchema, sitePageSchema, type SitePageRecord } from "@croebet/shared";
import { managementRequest } from "@/features/admin/management-api";
import { richTextPlainText, type RichTextDocument } from "@/lib/rich-text";

export function AdminPages({ pages }: { pages: SitePageRecord[] }) {
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

export function AdminPageEditor({ page }: { page: SitePageRecord | null }) {
  const router = useRouter();
  const isNew = page === null;
  const [document, setDocument] = useState<RichTextDocument>(() => page?.document ?? []);
  const [saving, setSaving] = useState(false);
  return <Card>
    <form className="grid gap-5" onSubmit={async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const title = String(form.get("title") ?? "").trim();
      const nextSlug = String(form.get("slug") ?? "").trim();
      const published = form.get("published") === "on";
      if (published && !richTextPlainText(document).trim()) {
        toast.error("Escreva o conteúdo da página antes de publicar.");
        return;
      }
      if (!pageWriteSchema.safeParse({ title, slug: nextSlug, document, published, showInMenu: form.get("showInMenu") === "on", version: page?.version ?? 0 }).success) {
        toast.error("Confira o título, o endereço e o conteúdo da página.");
        return;
      }
      const next = { title, slug: nextSlug, document, published, showInMenu: form.get("showInMenu") === "on" };
      setSaving(true);
      try {
        await managementRequest(isNew ? "/admin/pages" : `/admin/pages/${page.slug}`, sitePageSchema, isNew ? "POST" : "PATCH", { ...next, version: page?.version ?? 0 });
        toast.success("Alterações salvas."); router.push("/admin/paginas"); router.refresh();
      } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar a página."); }
      finally { setSaving(false); }
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
        <Button variant="ghost" disabled={saving} onClick={() => router.refresh()}>Recarregar</Button>
        <Button asChild variant="secondary"><Link href="/admin/paginas">Cancelar</Link></Button>
      </div>
    </form>
  </Card>;
}
