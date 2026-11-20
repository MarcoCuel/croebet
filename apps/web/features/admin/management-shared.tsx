"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auditPageSchema, type auditSchema } from "@croebet/shared";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import { Input } from "@/components/ui/input";
import { managementRequest } from "@/features/admin/management-api";

export const adminDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
export type ListQuery = { q: string; status: string; offset: number };
export function listHref(base: string, query: ListQuery) {
  return `${base}?${new URLSearchParams({ q: query.q, status: query.status, offset: String(query.offset) })}`;
}
export function ManagementSearch({ base, query, label, placeholder }: { base: string; query: ListQuery; label: string; placeholder: string }) {
  return <form action={base} className="w-full">
    <SearchInput name="q" defaultValue={query.q} aria-label={label} placeholder={placeholder} maxLength={80} className="min-w-0 flex-1" />
    <Input type="hidden" name="status" value={query.status} />
  </form>;
}
export function ListPagination({ base, query, hasMore }: { base: string; query: ListQuery; hasMore: boolean }) {
  return <nav aria-label="Paginação" className="mt-5 flex justify-between gap-3">
    {query.offset > 0 ? <Button asChild variant="secondary"><Link href={listHref(base, { ...query, offset: Math.max(0, query.offset - 20) })}>Anteriores</Link></Button> : <span />}
    {hasMore && <Button asChild variant="secondary"><Link href={listHref(base, { ...query, offset: query.offset + 20 })}>Próximos</Link></Button>}
  </nav>;
}
export function ManagementUnavailable() {
  const router = useRouter();
  return <Card className="grid justify-items-start gap-4"><p role="alert">Não foi possível carregar estes dados.</p><Button variant="secondary" onClick={() => router.refresh()}>Tentar novamente</Button></Card>;
}
export function AuditHistory({ targetId, initial }: { targetId: string; initial: ReturnType<typeof auditPageSchema.parse> }) {
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  return <Card className="min-w-0"><h2 className="font-semibold">Registro administrativo</h2>
    <ul className="mt-4 divide-y divide-contrast/6">{data.items.map((item: ReturnType<typeof auditSchema.parse>) => <li key={item.id} className="grid gap-1 py-4 text-sm">
      <p className="font-medium">{({ "user.permissions": "Permissão ou status alterado", "user.identity": "Nome ou usuário alterado", "wallet.adjustment": "Ajuste de Croins", "coupon.created": "Cupom criado", "coupon.updated": "Cupom atualizado" } as Record<string, string>)[item.action] ?? item.action}</p>
      {item.reason && <p className="break-words">{item.reason}</p>}<p className="text-xs text-muted">{item.actorUsername ? `@${item.actorUsername}` : "Conta removida"} · {adminDate(item.createdAt)}</p>
      {item.action === "wallet.adjustment" && <p className="text-xs text-muted">{item.details.direction === "add" ? "+" : "−"}{String(item.details.amount)} Croins</p>}
    </li>)}</ul>
    {!data.items.length && <p className="mt-4 text-sm text-muted">Nenhuma alteração administrativa registrada.</p>}
    {data.hasMore && <Button variant="secondary" loading={loading} className="mt-4" onClick={async () => {
      if (loading) return; setLoading(true);
      try { const next = await managementRequest(`/admin/audit/${targetId}?offset=${data.items.length}`, auditPageSchema); setData(current => ({ items: [...current.items, ...next.items], hasMore: next.hasMore })); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível carregar o registro."); }
      finally { setLoading(false); }
    }}>Carregar mais registros</Button>}
  </Card>;
}
