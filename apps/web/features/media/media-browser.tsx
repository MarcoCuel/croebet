"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { mediaListSchema, mediaItemSchema, mediaMaxBytes, mediaContentTypes, type MediaItem } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/shared/empty-state";
import { managementRequest } from "@/features/admin/management-api";
import { AdminListHeader } from "@/features/admin/admin-list-header";

export function MediaPreview({ url, name, className = "aspect-square w-full" }: { url: string; name: string; className?: string }) {
  return <div className={`relative overflow-hidden rounded-panel bg-contrast/3 ${className}`}><Image src={url} alt={name} fill sizes="(max-width: 640px) 50vw, 25vw" unoptimized className="object-contain" /></div>;
}

export function MediaBrowser({ onSelect }: { onSelect: (item: MediaItem) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<{ items: MediaItem[]; hasMore: boolean } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
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
  return <div className="grid min-w-0 gap-5">
    <AdminListHeader filters={<Button variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}><Upload className="size-4" aria-hidden="true" />{uploading ? "Enviando…" : "Enviar imagem"}</Button>} filterLabel="Ações da biblioteca" search={<SearchInput placeholder="Buscar imagens" value={q} maxLength={160} onChange={event => { setQ(event.target.value); setOffset(0); }} />} />
    <Input ref={fileInput} type="file" accept={mediaContentTypes.join(",")} aria-label="Enviar imagem" className="hidden" disabled={uploading} onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = "";
      if (!file || uploading) return;
      if (!(mediaContentTypes as readonly string[]).includes(file.type) || file.size > mediaMaxBytes || !file.size) { toast.error("Escolha um JPG, PNG ou WebP de até 10 MB."); return; }
      setUploading(true);
      try {
        const item = await managementRequest(`/admin/media?${new URLSearchParams({ name: file.name })}`, mediaItemSchema, "POST", file);
        setQ(""); setOffset(0); setRefresh(value => value + 1); onSelect(item);
        toast.success("Imagem enviada.");
      } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível enviar a imagem."); }
      finally { setUploading(false); }
    }} />
    {error ? <div role="alert" className="grid justify-items-start gap-4 text-sm"><p>{error}</p><Button variant="outline" onClick={() => setRefresh(value => value + 1)}>Tentar novamente</Button></div>
      : loading ? <p role="status" className="py-8 text-center text-sm text-muted">Carregando imagens…</p>
      : data?.items.length ? <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{data.items.map(item => <Button key={item.id} variant="ghost" className="h-auto min-w-0 flex-col items-stretch gap-2 border border-contrast/6 p-2 text-left" aria-label={`Selecionar ${item.name}`} onClick={() => onSelect(item)}>
        <MediaPreview url={item.url} name={item.name} /><span className="truncate text-sm">{item.name}</span><span className="text-xs font-normal text-muted">{item.width} × {item.height}</span>
      </Button>)}</div> : <EmptyState title={q ? "Nenhuma imagem encontrada." : "Nenhuma imagem enviada."} />}
    <div className="flex justify-end gap-2">
      {offset > 0 && <Button variant="outline" disabled={loading} onClick={() => setOffset(value => Math.max(0, value - 24))}>Anterior</Button>}
      {data?.hasMore && <Button variant="outline" disabled={loading || !!error} onClick={() => setOffset(value => value + 24)}>Próxima</Button>}
    </div>
  </div>;
}
