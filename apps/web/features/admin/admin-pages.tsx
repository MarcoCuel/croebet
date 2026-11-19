"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminListHeader, AdminFilterCount } from "@/features/admin/admin-list-header";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { pageWriteSchema, sitePageSchema, pageDeleteResultSchema, pageStatusSchema, pageSlugSchema, type SitePageRecord, type PageStatus, type PageAuthor } from "@croebet/shared";
import { managementRequest } from "@/features/admin/management-api";
import { adminDate } from "@/features/admin/management-shared";
import { richTextPlainText, type RichTextDocument } from "@/lib/rich-text";

const statusLabels: Record<PageStatus, string> = { draft: "Rascunho", pending: "Pendente", private: "Privada", scheduled: "Agendada", published: "Publicada", trash: "No lixo" };

type PageFilter = "all" | PageStatus;
const normalizeSearch = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function AdminPages({ pages }: { pages: SitePageRecord[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<PageFilter>("all");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SitePageRecord | null>(null);
  const filters: { value: PageFilter; label: string }[] = [
    { value: "all", label: "Todos" }, { value: "published", label: "Publicado" }, { value: "draft", label: "Rascunho" },
    ...(["pending", "private", "scheduled"] as const).filter(status => pages.some(page => page.status === status)).map(value => ({ value, label: statusLabels[value] })),
    { value: "trash", label: "Lixo" },
  ];
  const matchesFilter = (page: SitePageRecord, value: PageFilter) => value === "all" ? page.status !== "trash" : page.status === value;
  const visible = pages.filter(page => matchesFilter(page, filter) && normalizeSearch(`${page.title} ${page.slug}`).includes(normalizeSearch(search.trim())))
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
  async function changeStatus(page: SitePageRecord, status: "trash" | "draft") {
    if (pending) return;
    setPending(page.id);
    try {
      await managementRequest(`/admin/pages/${page.slug}`, sitePageSchema, "PATCH", {
        slug: page.slug, title: page.title, document: page.document, published: false, showInMenu: page.showInMenu,
        status, publishAt: null, authorId: page.authorId, version: page.version,
      });
      toast.success(status === "trash" ? "Página movida para o lixo." : "Página restaurada como rascunho.");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível alterar a página."); }
    finally { setPending(null); }
  }
  return <div className="grid min-w-0 gap-4">
    <AdminListHeader filterLabel="Filtrar páginas por status" filters={<>
        {filters.map(({ value, label }) => <Button key={value} size="sm" variant={filter === value ? "secondary" : "ghost"} aria-current={filter === value ? "page" : undefined} onClick={() => setFilter(value)}>
          {label} {filter === value && <AdminFilterCount count={pages.filter(page => matchesFilter(page, value)).length} />}
        </Button>)}
    </>} search={<SearchInput value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar páginas…" aria-label="Buscar páginas" />} />
    <Card className="overflow-hidden p-0 sm:p-0">
      {visible.length ? <ul aria-label="Páginas" className="divide-y divide-contrast/6">
        {visible.map(page => <li key={page.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 p-5">
          <div className="min-w-0 flex-1 basis-48">
            <div className="flex flex-wrap items-center gap-2">
              {page.status === "trash" ? <span className="break-words font-semibold">{page.title}</span> : <Link className="break-words font-semibold hover:underline" href={`/admin/paginas/${page.slug}`}>{page.title}</Link>}
              <Badge variant={page.published ? "default" : "secondary"}>{statusLabels[page.status]}</Badge>
            </div>
            <p className="mt-1 break-all text-sm text-muted">/{page.slug}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {page.status === "trash" ? <>
              <Button variant="secondary" size="sm" disabled={!!pending} loading={pending === page.id} onClick={() => changeStatus(page, "draft")}>Restaurar</Button>
              <Button variant="outline" size="sm" disabled={!!pending} onClick={() => setDeleting(page)}>Excluir permanentemente</Button>
            </> : <>
              <Button asChild variant="secondary" size="sm"><Link href={`/admin/paginas/${page.slug}`} aria-label={`Editar ${page.title}`}>Editar</Link></Button>
              <Button variant="outline" size="sm" disabled={!!pending} loading={pending === page.id} onClick={() => changeStatus(page, "trash")} aria-label={`Mover ${page.title} para o lixo`}>Lixo</Button>
              {page.published && <Button asChild variant="ghost" size="sm"><Link href={`/${page.slug}`} aria-label={`Ver ${page.title}`}>Ver página</Link></Button>}
            </>}
          </div>
        </li>)}
      </ul> : <p className="p-6 text-sm text-muted">{!pages.length ? "Nenhuma página criada ainda." : "Nenhuma página encontrada."}</p>}
    </Card>

    <Dialog open={!!deleting} onOpenChange={open => { if (!open && !pending) setDeleting(null); }}>
      <DialogContent aria-describedby={undefined} onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onPointerDownOutside={event => { if (pending) event.preventDefault(); }}>
        <DialogTitle>Excluir página permanentemente?</DialogTitle>
        <p className="mt-4 text-sm text-muted">A página “{deleting?.title}” será excluída permanentemente.</p>
        <Button variant="destructive" className="mt-5 w-full" loading={!!pending} onClick={async () => {
          if (!deleting || pending) return;
          setPending(deleting.id);
          try {
            await managementRequest(`/admin/pages/${deleting.slug}`, pageDeleteResultSchema, "DELETE", { version: deleting.version });
            toast.success("Página excluída."); setDeleting(null); router.refresh();
          } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir a página."); }
          finally { setPending(null); }
        }}>Excluir permanentemente</Button>
      </DialogContent>
    </Dialog>
  </div>;
}

function SettingRow({ label, children, onClick, disabled }: { label: string; children: ReactNode; onClick: () => void; disabled: boolean }) {
  return <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 text-sm">
    <dt className="py-2 text-muted">{label}</dt>
    <dd className="min-w-0"><Button variant="link" className="h-auto min-h-11 w-full justify-start px-0 py-2 text-left whitespace-normal break-words" aria-label={`Editar ${label.toLowerCase()}`} onClick={onClick} disabled={disabled}>{children}</Button></dd>
  </div>;
}
function localDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)).replace(" ", "T");
}
function titleSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100).replace(/-$/g, "");
}

type EditorDialog = "status" | "publish" | "slug" | "author" | "delete";
const dialogTitles: Record<EditorDialog, string> = { status: "Status", publish: "Publicar", slug: "Slug", author: "Autor", delete: "Mover página para o lixo?" };

export function AdminPageEditor({ page, authors, currentAuthor }: { page: SitePageRecord | null; authors: PageAuthor[]; currentAuthor: PageAuthor }) {
  const router = useRouter();
  const [document, setDocument] = useState<RichTextDocument>(() => page?.document ?? []);
  const [title, setTitle] = useState(page?.title ?? "");
  const [customSlug, setCustomSlug] = useState<string | null>(page?.slug ?? null);
  const slug = customSlug ?? titleSlug(title);
  const [status, setStatus] = useState<PageStatus>(page?.status ?? "draft");
  const [statusChosen, setStatusChosen] = useState(false);
  const [publishAt, setPublishAt] = useState<string | null>(page?.publishAt ?? null);
  const [authorId, setAuthorId] = useState(page?.authorId ?? currentAuthor.id);
  const [dateDefault, setDateDefault] = useState("");
  const [dialog, setDialog] = useState<EditorDialog | null>(null);
  const [pending, setPending] = useState<"save" | "delete" | null>(null);
  const author = authors.find(item => item.id === authorId);
  const authorName = author?.displayName ?? page?.authorName ?? currentAuthor.displayName;
  const statusToSave = !page && !statusChosen && status === "draft" ? "published" : status;
  const scheduled = statusToSave === "scheduled";
  const effectiveStatus = statusToSave;
  const action = scheduled ? "Agendar" : !page && statusToSave === "published" ? "Publicar" : "Salvar";

  function openPublication() {
    setDateDefault(localDate(publishAt ?? new Date(Date.now() + 3600000).toISOString()));
    setDialog("publish");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if ((statusToSave === "published" || scheduled) && !richTextPlainText(document).trim()) return void toast.error("Escreva o conteúdo da página antes de publicar.");
    const input = pageWriteSchema.safeParse({ title, slug, document, status: effectiveStatus, publishAt, authorId,
      published: effectiveStatus === "published", showInMenu: page?.showInMenu ?? false, version: page?.version ?? 0 });
    if (!input.success) return void toast.error(input.error.issues[0]?.message ?? "Confira os dados da página.");
    setPending("save");
    try {
      const saved = await managementRequest(page ? `/admin/pages/${page.slug}` : "/admin/pages", sitePageSchema, page ? "PATCH" : "POST", input.data);
      toast.success(saved.status === "scheduled" ? "Publicação agendada." : "Página salva.");
      router.replace(`/admin/paginas/${saved.slug}`); router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar a página."); }
    finally { setPending(null); }
  }

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (dialog === "status") {
      const next = pageStatusSchema.parse(form.get("status"));
      setStatusChosen(true);
      setStatus(next === "published" && publishAt && Date.parse(publishAt) > Date.now() ? "scheduled" : next);
      if (next === "scheduled" && (!publishAt || Date.parse(publishAt) <= Date.now())) { openPublication(); return; }
    }
    if (dialog === "slug") {
      const parsed = pageSlugSchema.safeParse(String(form.get("slug") ?? "").trim());
      if (!parsed.success) return void toast.error(parsed.error.issues[0].message);
      setCustomSlug(parsed.data);
    }
    if (dialog === "author") setAuthorId(String(form.get("authorId")));
    if (dialog === "publish") {
      const value = String(form.get("publishAt") ?? "");
      const date = new Date(`${value}:00-03:00`);
      if (!value || Number.isNaN(date.getTime())) return void toast.error("Escolha a data e a hora da publicação.");
      if (status === "scheduled" && date.getTime() <= Date.now()) return void toast.error("Escolha uma data futura para agendar a publicação.");
      setPublishAt(date.toISOString());
      if ((statusToSave === "published" || statusToSave === "scheduled") && date.getTime() > Date.now()) setStatus("scheduled");
    }
    setDialog(null);
  }

  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
    <form id="page-editor" onSubmit={save} className="min-w-0">
      <Card className="grid min-w-0 gap-5" inert={!!pending}>
        <Field>Título<Input name="title" value={title} onChange={event => setTitle(event.target.value)} required maxLength={100} /></Field>
        <RichTextEditor label="Conteúdo principal" initialValue={document} onChange={setDocument} />
      </Card>
    </form>
    <aside className="grid min-w-0 gap-5 xl:sticky xl:top-[calc(var(--header-height)+1rem)]" aria-label="Configurações da página">
      <Button type="submit" form="page-editor" loading={pending === "save"} disabled={!!pending}>{action}</Button>
      <Card className="grid gap-5">
        <h2 className="break-words font-semibold">{title || "Nova página"}</h2>
        <p className="text-xs text-muted">{page?.updatedAt ? `Última edição ${adminDate(page.updatedAt)}${page.lastEditedBy ? ` por ${page.lastEditedBy}` : ""}` : "Ainda não salva"}</p>
        <dl className="grid gap-1">
          <SettingRow label="Status" onClick={() => setDialog("status")} disabled={!!pending}>{statusLabels[status]}</SettingRow>
          <SettingRow label="Publicar" onClick={openPublication} disabled={!!pending}>{publishAt ? adminDate(publishAt) : page?.publishedAt ? adminDate(page.publishedAt) : "Imediatamente"}</SettingRow>
          <SettingRow label="Slug" onClick={() => setDialog("slug")} disabled={!!pending}>{slug || "Definir slug"}</SettingRow>
          <SettingRow label="Autor" onClick={() => setDialog("author")} disabled={!!pending}>{authorName}</SettingRow>
        </dl>
        {page && <Button variant="outline" className="mt-3 w-full" onClick={() => setDialog("delete")} disabled={!!pending}>Mover para o lixo</Button>}
      </Card>
    </aside>
    <Dialog open={dialog !== null} onOpenChange={open => { if (!open && !pending) setDialog(null); }}>
      <DialogContent aria-describedby={undefined} onEscapeKeyDown={event => { if (pending) event.preventDefault(); }} onPointerDownOutside={event => { if (pending) event.preventDefault(); }}>
        <DialogTitle>{dialog ? dialogTitles[dialog] : "Configurações"}</DialogTitle>
        {dialog === "delete" ? <div className="mt-5 grid gap-5">
          <p className="text-sm text-muted">A página “{page?.title}” será movida para o lixo.</p>
          <Button variant="destructive" loading={pending === "delete"} onClick={async () => {
            if (!page || pending) return;
            setPending("delete");
            try {
              await managementRequest(`/admin/pages/${page.slug}`, sitePageSchema, "PATCH", { slug: page.slug, title: page.title, document: page.document, published: false, showInMenu: page.showInMenu, status: "trash", publishAt: null, authorId: page.authorId, version: page.version });
              toast.success("Página movida para o lixo."); setDialog(null); router.push("/admin/paginas"); router.refresh();
            } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir a página."); }
            finally { setPending(null); }
          }}>Mover para o lixo</Button>
        </div> : <form key={dialog} className="mt-5 grid gap-5" onSubmit={apply}>
          {dialog === "status" && <Field>Status<Select name="status" defaultValue={status}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>}
          {dialog === "slug" && <Field>Slug<Input name="slug" defaultValue={slug} required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></Field>}
          {dialog === "author" && <Field>Autor<Select name="authorId" defaultValue={authorId}>
            {!author && <option value={authorId}>{authorName}</option>}
            {authors.map(item => <option key={item.id} value={item.id}>{item.displayName} (@{item.username})</option>)}
          </Select></Field>}
          {dialog === "publish" && <>
            <Field>Data e hora<Input name="publishAt" type="datetime-local" defaultValue={dateDefault} required aria-label="Data e hora (Brasília)" /></Field>
            <Button variant="secondary" onClick={() => { setPublishAt(null); if (status === "scheduled") setStatus("published"); setDialog(null); }}>Imediatamente</Button>
          </>}
          <Button type="submit">Aplicar</Button>
        </form>}
      </DialogContent>
    </Dialog>
  </div>;
}
