"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Switch } from "@/components/ui/switch";
import { formatBalance } from "@/features/wallet/wallet";
import { couponStatus, useDemoCoupons, type Coupon } from "@/features/admin/coupon-demo";

const date = (value: string) => new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
function Status({ coupon }: { coupon: Coupon }) {
  const status = couponStatus(coupon);
  return <Badge variant={status === "Ativo" ? "default" : "secondary"}>{status}</Badge>;
}
export function AdminCoupons() {
  const { coupons } = useDemoCoupons();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todos");
  const visible = coupons.filter((c) => c.code.toLowerCase().includes(search.trim().toLowerCase()) && (filter === "Todos" || couponStatus(c) === filter));
  return <>
    <h1 className="sr-only">Cupons</h1>
    <SearchInput aria-label="Buscar cupons" placeholder="Buscar por código" value={search} onChange={(e) => setSearch(e.target.value)} />
    <div className="my-4 flex flex-wrap gap-1" role="group" aria-label="Status dos cupons">
      {["Todos", "Ativo", "Agendado", "Pausado", "Expirado", "Esgotado"].map((status) => <Button key={status} size="sm" variant={filter === status ? "secondary" : "ghost"} aria-pressed={filter === status} onClick={() => setFilter(status)}>{status}</Button>)}
    </div>
    <ul className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{visible.map((c) => <li key={c.id}><Card className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="break-all font-semibold">{c.code}</h2><Status coupon={c} /></div>
      <p className="text-2xl font-semibold tabular-nums">{formatBalance.format(c.amount)} <span className="text-sm font-normal text-muted">Croins</span></p>
      <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt className="text-xs text-muted">Resgates</dt><dd className="mt-1">{c.redemptions.length} / {c.limit ?? "ilimitado"}</dd></div><div><dt className="text-xs text-muted">Distribuídos</dt><dd className="mt-1">{formatBalance.format(c.redemptions.reduce((sum, r) => sum + r.amount, 0))} Croins</dd></div></dl>
      <div className="mt-auto space-y-1 text-xs text-muted"><p>Início: {c.startsAt ? date(c.startsAt) : "Imediato"}</p><p>Término: {c.endsAt ? date(c.endsAt) : "Sem vencimento"}</p></div>
      <Button asChild variant="secondary" size="sm" className="self-start"><Link href={`/admin/cupons/${c.id}`} aria-label={`Gerenciar ${c.code}`}>Gerenciar</Link></Button>
    </Card></li>)}</ul>
    {!visible.length && <Card className="text-sm text-muted">Nenhum cupom encontrado.</Card>}
  </>;
}

export function AdminCouponEditor({ id }: { id: string }) {
  const { coupons, save } = useDemoCoupons();
  const router = useRouter();
  const isNew = id === "novo";
  const coupon = coupons.find((c) => c.id === id);
  const [search, setSearch] = useState("");
  if (!isNew && !coupon) notFound();
  const redemptions = coupon?.redemptions ?? [];
  return <>
    <h1 className="sr-only">{isNew ? "Novo cupom" : "Gerenciar cupom"}</h1>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <Card><h2 className="mb-5 font-semibold">Configuração</h2>
        <form className="grid gap-5" onSubmit={(e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const code = String(form.get("code")).trim().toUpperCase();
          const amount = Number(form.get("amount"));
          const limit = form.get("limit") ? Number(form.get("limit")) : null;
          const startsAt = String(form.get("startsAt") ?? "");
          const endsAt = String(form.get("endsAt") ?? "");
          if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return void toast.error("Use de 3 a 32 letras, números, hífen ou sublinhado no código.");
          if (coupons.some((c) => c.id !== id && c.code === code)) return void toast.error("Este código já existe.");
          if (!Number.isSafeInteger(amount) || amount <= 0 || (limit !== null && (!Number.isSafeInteger(limit) || limit < Math.max(1, redemptions.length)))) return void toast.error("Confira o valor e o limite de resgates.");
          if (startsAt && endsAt && startsAt >= endsAt) return void toast.error("O término deve ser posterior ao início.");
          const next: Coupon = { id: coupon?.id ?? crypto.randomUUID(), code, amount, limit, startsAt, endsAt, paused: form.get("paused") === "on", redemptions };
          try { save(isNew ? [next, ...coupons] : coupons.map((c) => c.id === id ? next : c)); toast.success("Cupom salvo."); router.push(`/admin/cupons/${next.id}`); } catch { toast.error("Não foi possível salvar o cupom neste navegador."); }
        }}>
          <Field>Código do cupom<Input name="code" required minLength={3} maxLength={32} defaultValue={coupon?.code} placeholder="Ex.: CROELIVE" autoCapitalize="characters" autoComplete="off" spellCheck={false} className="uppercase" /></Field>
          <div className="grid gap-5 sm:grid-cols-2"><Field>Croins por resgate<Input type="number" name="amount" required min={1} step={1} max={Number.MAX_SAFE_INTEGER} defaultValue={coupon?.amount} /></Field><Field>Limite total de resgates<Input type="number" name="limit" min={Math.max(1, redemptions.length)} step={1} max={Number.MAX_SAFE_INTEGER} defaultValue={coupon?.limit ?? ""} placeholder="Ilimitado" /></Field></div>
          <div className="grid gap-5 sm:grid-cols-2"><Field>Início (opcional)<Input type="datetime-local" name="startsAt" defaultValue={coupon?.startsAt} /></Field><Field>Término (opcional)<Input type="datetime-local" name="endsAt" defaultValue={coupon?.endsAt} /></Field></div>
          <Field className="flex items-center justify-between">Cupom pausado<Switch name="paused" defaultChecked={coupon?.paused} /></Field>
          <div className="flex flex-wrap gap-2"><Button type="submit">Salvar cupom</Button><Button asChild variant="secondary"><Link href="/admin/cupons">Voltar para cupons</Link></Button></div>
        </form>
      </Card>
      <Card className="grid gap-5"><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Resumo</h2>{coupon && <Status coupon={coupon} />}</div><dl className="grid gap-5 text-sm"><div><dt className="text-muted">Resgates realizados</dt><dd className="mt-1 text-xl font-semibold">{redemptions.length}</dd></div><div><dt className="text-muted">Croins distribuídos</dt><dd className="mt-1 text-xl font-semibold">{formatBalance.format(redemptions.reduce((sum, r) => sum + r.amount, 0))}</dd></div><div><dt className="text-muted">Limite por usuário</dt><dd className="mt-1">1 resgate</dd></div></dl></Card>
    </div>
    {!isNew && <Card className="mt-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Histórico de resgates</h2><SearchInput aria-label="Buscar usuário nos resgates" placeholder="Buscar usuário" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" /></div>
      <div className="overflow-x-auto" data-lenis-prevent><table className="w-full text-left text-sm"><thead className="text-xs text-muted"><tr><th scope="col" className="py-3 font-medium">Usuário</th><th scope="col" className="px-4 py-3 font-medium">Data do resgate</th><th scope="col" className="py-3 text-right font-medium">Croins</th></tr></thead><tbody>{redemptions.filter((r) => r.username.toLowerCase().includes(search.trim().toLowerCase())).map((r) => <tr key={r.username} className="border-t border-contrast/6"><td className="py-4">@{r.username}</td><td className="px-4 py-4 whitespace-nowrap text-muted">{date(r.at)}</td><td className="py-4 text-right tabular-nums">{formatBalance.format(r.amount)}</td></tr>)}</tbody></table></div>
      {!redemptions.some((r) => r.username.toLowerCase().includes(search.trim().toLowerCase())) && <p className="py-6 text-center text-sm text-muted">{search ? "Nenhum usuário encontrado." : "Nenhum resgate realizado."}</p>}
    </Card>}
  </>;
}
