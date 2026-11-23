"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { mediaListSchema, mediaItemSchema, mediaDeleteResultSchema, mediaMaxBytes, mediaContentTypes, type MediaItem } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { managementRequest } from "@/features/admin/management-api";
import { AdminListHeader } from "@/features/admin/admin-list-header";

export function MediaPreview({ url, name, className = "aspect-square w-full" }: { url: string; name: string; className?: string }) {
  return <div className={`relative overflow-hidden rounded-panel bg-contrast/3 ${className}`}><Image src={url} alt={name} fill sizes="(max-width: 640px) 50vw, 25vw" unoptimized className="object-contain" /></div>;
}

export function MediaBrowser({ onSelect }: { onSelect?: (item: MediaItem) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<{ items: MediaItem[]; hasMore: boolean } | null>(null);
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const [multiple, setMultiple] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const activeItem = selected.length === 1 ? selected[0] : undefined;
  function selectItems(items: MediaItem[]) {
    setSelected(items); setTitle(items.length === 1 ? items[0].title : ""); setDescription(items.length === 1 ? items[0].description : ""); setConfirm(false);
  }
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      managementRequest(`/admin/media?${new URLSearchParams({ q, offset: String(offset) })}`, mediaListSchema)
        .then(result => { if (active) setData(result); })
        .catch(error => { if (active) setError(error instanceof Error ? error.message : "Não foi possível carregar as imagens."); })
        .finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [q, offset, refresh]);
  async function upload(files: File[]) {
    if (!files.length || uploading) return;
    setUploading(true);
    let last: MediaItem | undefined;
    let failed = 0;
    for (const file of files) {
      if (!(mediaContentTypes as readonly string[]).includes(file.type) || file.size > mediaMaxBytes || !file.size) { failed++; toast.error(`${file.name}: escolha um JPG, PNG ou WebP de até 10 MB.`); continue; }
      try { last = await managementRequest(`/admin/media?${new URLSearchParams({ name: file.name })}`, mediaItemSchema, "POST", file); }
      catch (error) { failed++; toast.error(`${file.name}: ${error instanceof Error ? error.message : "não foi possível enviar."}`); }
    }
    if (last) { selectItems([last]); setMultiple(false); setQ(""); setOffset(0); setRefresh(value => value + 1); toast.success(failed ? "Imagens válidas enviadas." : "Envio concluído."); }
    setUploading(false);
  }
  async function removeSelected() {
    if (!confirm) { setConfirm(true); return; }
    setPending(true);
    const remaining: MediaItem[] = [];
    for (const item of selected) {
      try { await managementRequest(`/admin/media/${item.id}`, mediaDeleteResultSchema, "DELETE"); }
      catch (error) { remaining.push(item); toast.error(`${item.name}: ${error instanceof Error ? error.message : "não foi possível excluir."}`); }
    }
    if (remaining.length < selected.length) toast.success("Exclusão concluída.");
    selectItems(remaining); setConfirm(false); setRefresh(value => value + 1); setPending(false);
  }
  return <div className="relative grid min-w-0 gap-5" onDragEnter={event => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); dragDepth.current++; setDragging(true); } }} onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDragLeave={event => { event.preventDefault(); if (--dragDepth.current <= 0) { dragDepth.current = 0; setDragging(false); } }} onDrop={event => { event.preventDefault(); dragDepth.current = 0; setDragging(false); void upload(Array.from(event.dataTransfer.files)); }}>
    {dragging && <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-panel border-2 border-dashed border-primary bg-background/90 text-sm font-medium">Solte as imagens para enviar</div>}
    <AdminListHeader filters={<div className="flex gap-2"><Button type="button" variant="outline" onClick={() => { setMultiple(!multiple); selectItems([]); }}>{multiple ? "Cancelar seleção" : "Selecionar vários"}</Button><Button type="button" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}><Upload className="size-4" aria-hidden="true" />{uploading ? "Enviando…" : "Enviar imagens"}</Button></div>} filterLabel="Ações da biblioteca" search={<SearchInput placeholder="Buscar imagens" value={q} maxLength={160} onChange={event => { setQ(event.target.value); setOffset(0); }} />} />
    <Input ref={fileInput} type="file" multiple accept={mediaContentTypes.join(",")} aria-label="Enviar imagens" className="hidden" disabled={uploading} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void upload(files); }} />
    {error ? <div role="alert" className="grid justify-items-start gap-4 text-sm"><p>{error}</p><Button type="button" variant="outline" onClick={() => setRefresh(value => value + 1)}>Tentar novamente</Button></div>
      : loading ? <p role="status" className="py-8 text-center text-sm text-muted">Carregando imagens…</p>
      : data?.items.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{data.items.map(item => <Button type="button" key={item.id} variant="ghost" className={`h-auto min-w-0 flex-col items-stretch gap-2 border p-2 text-left ${selected.some(value => value.id === item.id) ? "border-primary" : "border-contrast/6"}`} aria-label={`Selecionar ${item.name}`} aria-pressed={selected.some(value => value.id === item.id)} onClick={() => selectItems(multiple ? selected.some(value => value.id === item.id) ? selected.filter(value => value.id !== item.id) : [...selected, item] : [item])}>
        <MediaPreview url={item.url} name={item.title || item.name} /><span className="truncate text-sm">{item.title || item.name}</span><span className="text-xs font-normal text-muted">{item.width} × {item.height}</span>
      </Button>)}</div> : <EmptyState title={q ? "Nenhuma imagem encontrada." : "Nenhuma imagem enviada."} />}
    <div className="flex justify-end gap-2">
      {offset > 0 && <Button type="button" variant="outline" disabled={loading} onClick={() => setOffset(value => Math.max(0, value - 24))}>Anterior</Button>}
      {data?.hasMore && <Button type="button" variant="outline" disabled={loading || !!error} onClick={() => setOffset(value => value + 24)}>Próxima</Button>}
    </div>
    {selected.length > 0 && <div className="grid gap-4 rounded-panel border border-contrast/6 p-4">
      <p className="text-sm font-medium">{selected.length === 1 ? activeItem?.name : `${selected.length} imagens selecionadas`}</p>
      {activeItem && <><p className="text-xs text-muted">{activeItem.width} × {activeItem.height} · {Math.ceil(activeItem.bytes / 1024)} KB · {new Date(activeItem.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
        <label className="grid gap-2 text-sm">Título<Input value={title} maxLength={160} onChange={event => setTitle(event.target.value)} /></label>
        <label className="grid gap-2 text-sm">Descrição<Textarea className="min-h-20 w-full rounded-md border border-contrast/10 bg-transparent p-3 text-sm" value={description} maxLength={2000} onChange={event => setDescription(event.target.value)} /></label>
        <div><Button type="button" variant="outline" disabled={pending || (title === activeItem.title && description === activeItem.description)} onClick={async () => { setPending(true); try { const item = await managementRequest(`/admin/media/${activeItem.id}`, mediaItemSchema, "PATCH", { title, description }); selectItems([item]); setRefresh(value => value + 1); toast.success("Imagem atualizada."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); } finally { setPending(false); } }}>Salvar alterações</Button></div></>}
      {confirm && <p className="text-sm">Excluir {selected.length === 1 ? "esta imagem" : "as imagens selecionadas"} permanentemente?</p>}
      <div className="flex flex-wrap gap-2">{onSelect && activeItem && <Button type="button" disabled={pending} onClick={() => onSelect(activeItem)}>Usar imagem</Button>}<Button type="button" variant="outline" loading={pending} onClick={() => void removeSelected()}>{confirm ? "Confirmar exclusão" : selected.length === 1 ? "Excluir imagem" : "Excluir imagens"}</Button>{confirm && <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirm(false)}>Cancelar</Button>}</div>
    </div>}
  </div>;
}
