"use client";

import { resourceResultSchema } from "@croebet/shared";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { couponWriteSchema, couponsSchema, couponDetailSchema, redemptionsSchema, type Coupon } from "@croebet/shared";
import { toast } from "sonner";
import { AdminListHeader, AdminFilterCount } from "@/features/admin/admin-list-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Switch } from "@/components/ui/switch";
import { formatBalance } from "@/features/wallet/wallet";
import { managementRequest } from "@/features/admin/management-api";
import { adminDate, AuditHistory, ManagementSearch, ListPagination, listHref, type ListQuery } from "@/features/admin/management-shared";

function Status({ coupon }: { coupon: Coupon }) { return <Badge variant={coupon.status === "Ativo" ? "default" : "secondary"}>{coupon.status}</Badge>; }
export function AdminCoupons({ initial, query }: { initial: ReturnType<typeof couponsSchema.parse>; query: ListQuery }) {
  return <div className="grid min-w-0 gap-4">
    <h1 className="sr-only">Cupons</h1>
    <AdminListHeader create={{ href: "/admin/cupons/novo", label: "Criar cupom" }} filterLabel="Status dos cupons" filters={<>{["Todos", "Ativo", "Agendado", "Pausado", "Expirado", "Esgotado"].map(status => <Button key={status} size="sm" variant={query.status === status ? "secondary" : "ghost"} asChild><Link href={listHref("/admin/cupons", { ...query, status, offset: 0 })} aria-current={query.status === status ? "page" : undefined}>{status} {query.status === status && <AdminFilterCount count={initial.counts[status as keyof typeof initial.counts]} />}</Link></Button>)}</>} search={<ManagementSearch base="/admin/cupons" query={query} label="Buscar cupons" placeholder="Buscar por código" />} />
    <Card className="overflow-hidden p-0 sm:p-0">
      {initial.items.length ? <ul aria-label="Cupons" className="divide-y divide-contrast/6">
        {initial.items.map(c => <li key={c.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 p-5">
          <div className="min-w-0 flex-1 basis-48">
            <div className="flex flex-wrap items-center gap-2">
              <Link className="break-all font-semibold hover:underline" href={`/admin/cupons/${c.id}`}>{c.code}</Link>
              <Status coupon={c} />
            </div>
            <p className="mt-1 text-sm text-muted"><span className="tabular-nums">{formatBalance.format(c.amount)}</span> Croins por resgate</p>
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
            <div><dt className="text-xs text-muted">Resgates</dt><dd className="mt-1 tabular-nums">{c.redeemed} / {c.limit ?? "ilimitado"}</dd></div>
            <div><dt className="text-xs text-muted">Distribuídos</dt><dd className="mt-1 tabular-nums">{formatBalance.format(c.distributed)} Croins</dd></div>
            <div><dt className="text-xs text-muted">Início</dt><dd className="mt-1">{c.startsAt ? adminDate(c.startsAt) : "Imediato"}</dd></div>
            <div><dt className="text-xs text-muted">Término</dt><dd className="mt-1">{c.endsAt ? adminDate(c.endsAt) : "Sem vencimento"}</dd></div>
          </dl>
          <Button asChild variant="secondary" size="sm"><Link href={`/admin/cupons/${c.id}`} aria-label={`Gerenciar ${c.code}`}>Gerenciar</Link></Button>
        </li>)}
      </ul> : <EmptyState title="Nenhum cupom encontrado." />}
    </Card>
    <ListPagination base="/admin/cupons" query={query} hasMore={initial.hasMore} />
  </div>;
}
const inputDate = (value: string | null | undefined) => value ? new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)).replace(" ", "T") : "";
const utcDate = (value: string) => value ? new Date(`${value}:00-03:00`).toISOString() : null;
export function AdminCouponEditor({ initial }: { initial: ReturnType<typeof couponDetailSchema.parse> | null }) {
  const coupon = initial?.coupon;
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [redemptions, setRedemptions] = useState(initial?.redemptions ?? { items: [], hasMore: false });
  const [loading, setLoading] = useState(false);
  async function loadRedemptions(more: boolean) {
    if (!coupon || loading) return; setLoading(true);
    const q = more ? appliedSearch : search;
    try {
      const next = await managementRequest(`/admin/coupons/${coupon.id}/redemptions?${new URLSearchParams({ q, offset: String(more ? redemptions.items.length : 0) })}`, redemptionsSchema);
      setRedemptions(current => ({ items: more ? [...current.items, ...next.items] : next.items, hasMore: next.hasMore })); setAppliedSearch(q);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível consultar os resgates."); }
    finally { setLoading(false); }
  }
  return <>
    <h1 className="sr-only">{coupon ? "Gerenciar cupom" : "Novo cupom"}</h1>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <Card><h2 className="mb-5 font-semibold">Configuração</h2><form className="grid gap-5" onSubmit={async event => {
        event.preventDefault(); if (saving) return;
        const form = new FormData(event.currentTarget);
        let dates;
        try { dates = { startsAt: utcDate(String(form.get("startsAt") ?? "")), endsAt: utcDate(String(form.get("endsAt") ?? "")) }; }
        catch { return void toast.error("Confira as datas do cupom."); }
        const input = couponWriteSchema.safeParse({ code: form.get("code"), amount: Number(form.get("amount")), limit: form.get("limit") ? Number(form.get("limit")) : null,
          ...dates, paused: form.get("paused") === "on", version: coupon?.version ?? 0, reason: form.get("reason") });
        if (!input.success) return void toast.error(input.error.issues[0].message);
        setSaving(true);
        try {
          const saved = await managementRequest(coupon ? `/admin/coupons/${coupon.id}` : "/admin/coupons", resourceResultSchema, coupon ? "PATCH" : "POST", input.data);
          toast.success("Cupom salvo."); router.push(`/admin/cupons/${saved.id}`); router.refresh();
        } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o cupom."); }
        finally { setSaving(false); }
      }}>
        <Field>Código do cupom<Input name="code" required minLength={3} maxLength={32} defaultValue={coupon?.code} placeholder="Ex.: CROELIVE" autoCapitalize="characters" autoComplete="off" spellCheck={false} className="uppercase" disabled={saving} /></Field>
        <div className="grid gap-5 sm:grid-cols-2"><Field>Croins por resgate<Input type="number" name="amount" required min={1} step={1} max={Number.MAX_SAFE_INTEGER} defaultValue={coupon?.amount} disabled={saving} /></Field><Field>Limite total de resgates<Input type="number" name="limit" min={Math.max(1, coupon?.redeemed ?? 0)} step={1} max={Number.MAX_SAFE_INTEGER} defaultValue={coupon?.limit ?? ""} placeholder="Ilimitado" disabled={saving} /></Field></div>
        <div className="grid gap-5 sm:grid-cols-2"><Field>Início (Brasília, UTC−03)<Input type="datetime-local" name="startsAt" defaultValue={inputDate(coupon?.startsAt)} disabled={saving} /></Field><Field>Término (Brasília, UTC−03)<Input type="datetime-local" name="endsAt" defaultValue={inputDate(coupon?.endsAt)} disabled={saving} /></Field></div>
        <Field className="flex items-center justify-between">Cupom pausado<Switch name="paused" defaultChecked={coupon?.paused} disabled={saving} /></Field>
        <Field>Motivo (opcional)<Input name="reason" maxLength={256} disabled={saving} /></Field>
        <div className="flex flex-wrap gap-2"><Button type="submit" loading={saving}>Salvar cupom</Button><Button asChild variant="secondary"><Link href="/admin/cupons">Voltar para cupons</Link></Button></div>
      </form></Card>
      <Card className="grid gap-5"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Resumo</h2>{coupon && <Status coupon={coupon} />}</div><dl className="grid gap-5 text-sm"><div><dt className="text-muted">Resgates realizados</dt><dd className="mt-1 text-xl font-semibold">{coupon?.redeemed ?? 0}</dd></div><div><dt className="text-muted">Croins distribuídos</dt><dd className="mt-1 text-xl font-semibold">{formatBalance.format(coupon?.distributed ?? 0)}</dd></div><div><dt className="text-muted">Limite por usuário</dt><dd className="mt-1">1 resgate</dd></div></dl></Card>
    </div>
    {coupon && <Card className="mt-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Histórico de resgates</h2><form className="flex gap-2" onSubmit={event => { event.preventDefault(); void loadRedemptions(false); }}><SearchInput aria-label="Buscar usuário nos resgates" placeholder="Buscar usuário" value={search} onChange={event => setSearch(event.target.value)} className="w-full sm:w-64" maxLength={80} /><Button type="submit" variant="secondary" loading={loading}>Buscar</Button></form></div>
      <div className="overflow-x-auto" data-lenis-prevent><table className="w-full text-left text-sm"><thead className="text-xs text-muted"><tr><th scope="col" className="py-3 font-medium">Usuário</th><th scope="col" className="px-4 py-3 font-medium">Data do resgate</th><th scope="col" className="py-3 text-right font-medium">Croins</th></tr></thead><tbody>{redemptions.items.map(r => <tr key={r.id} className="border-t border-contrast/6"><td className="py-4">{r.username ? `@${r.username}` : "Conta removida"}</td><td className="px-4 py-4 whitespace-nowrap text-muted">{adminDate(r.createdAt)}</td><td className="py-4 text-right tabular-nums">{formatBalance.format(r.amount)}</td></tr>)}</tbody></table></div>
      {!redemptions.items.length && <EmptyState title={appliedSearch ? "Nenhum usuário encontrado." : "Nenhum resgate realizado."} />}
      {redemptions.hasMore && <Button variant="secondary" loading={loading} onClick={() => void loadRedemptions(true)}>Carregar mais resgates</Button>}
    </Card>}
    {initial && <div className="mt-5"><AuditHistory targetId={initial.coupon.id} initial={initial.audit} /></div>}
  </>;
}
