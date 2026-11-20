"use client";

import { Balance } from "@/features/wallet/balance";
import { AdminUserDelete } from "@/features/admin/admin-user-delete";
import { EmptyState } from "@/components/shared/empty-state";
import { EditableRow } from "@/components/shared/editable-row";
import { adminUserIdentitySchema, commandResultSchema } from "@croebet/shared";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminUserDetailSchema, adminUsersSchema, transactionsSchema, userChangeSchema, type AdminUser } from "@croebet/shared";
import { toast } from "sonner";
import { ArrowUpRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { AdminListHeader, AdminFilterCount } from "@/features/admin/admin-list-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatBalance } from "@/features/wallet/wallet";
import { useSession } from "@/features/auth/session-context";
import { AdminUserBalance } from "@/features/admin/admin-user-balance";
import { managementRequest } from "@/features/admin/management-api";
import { adminDate, AuditHistory, ManagementSearch, ListPagination, listHref, type ListQuery } from "@/features/admin/management-shared";

const roleLabel = { user: "Usuário", admin: "Administrador" };
function UserAvatar({ user, large = false }: { user: AdminUser; large?: boolean }) {
  return <Avatar className={large ? "size-16" : "size-10"} aria-hidden="true">
    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}<AvatarFallback>{Array.from(user.displayName)[0]}</AvatarFallback>
  </Avatar>;
}
function Status({ user }: { user: AdminUser }) {
  return <Badge variant="secondary" className={user.status === "active" ? "bg-prediction-yes/10 text-prediction-yes" : "bg-prediction-no/10 text-prediction-no"}>{user.deletionScheduledAt ? "Exclusão agendada" : user.status === "active" ? "Ativo" : "Suspenso"}</Badge>;
}
export function AdminUsers({ initial, query }: { initial: ReturnType<typeof adminUsersSchema.parse>; query: ListQuery }) {
  return <div className="grid min-w-0 gap-4">
    <h1 className="sr-only">Usuários</h1>
    <AdminListHeader filterLabel="Status dos usuários" filters={<>{[["all", "Todos"], ["active", "Ativos"], ["suspended", "Suspensos"]].map(([value, label]) => <Button key={value} size="sm" variant={query.status === value ? "secondary" : "ghost"} asChild><Link href={listHref("/admin/usuarios", { ...query, status: value, offset: 0 })} aria-current={query.status === value ? "page" : undefined}>{label} {query.status === value && <AdminFilterCount count={initial.counts[value as keyof typeof initial.counts]} />}</Link></Button>)}</>} search={<ManagementSearch base="/admin/usuarios" query={query} label="Buscar usuários no admin" placeholder="Buscar por nome ou usuário" />} />
    <Card className="overflow-hidden p-0 sm:p-0">
      <ul className="divide-y divide-contrast/6">{initial.items.map(user => <li key={user.id}><Link href={`/admin/usuarios/${user.id}`} aria-label={`Ver usuário ${user.username}`} className="grid grid-cols-2 items-center gap-3 p-5 transition-colors hover:bg-contrast/10 xl:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_2rem]">
        <div className="col-span-2 flex min-w-0 items-center gap-3 xl:col-span-1"><UserAvatar user={user} /><div className="min-w-0"><p className="truncate text-sm font-semibold">{user.displayName}</p><p className="truncate text-xs text-muted">@{user.username}</p></div></div>
        <span className="text-sm text-muted">{roleLabel[user.role]}</span><Status user={user} /><span className="col-span-2 text-sm font-medium tabular-nums xl:col-span-1">{formatBalance.format(user.balance)} <span className="text-xs text-muted">Croins</span></span><ArrowUpRight className="hidden size-4 justify-self-end text-muted xl:block" aria-hidden="true" />
      </Link></li>)}</ul>
      {!initial.items.length && <EmptyState title="Nenhum usuário encontrado." />}
    </Card>
    <ListPagination base="/admin/usuarios" query={query} hasMore={initial.hasMore} />
  </div>;
}
function UserIdentity({ user, field }: { user: AdminUser; field: "displayName" | "username" }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { refreshAccount } = useSession();
  const label = field === "displayName" ? "Nome" : "Nome de usuário";
  return <EditableRow label={label} value={field === "username" ? `@${user.username}` : user.displayName} open={open} onOpenChange={value => { if (!pending) setOpen(value); }}>
    <DialogTitle>Editar {label.toLocaleLowerCase("pt-BR")}</DialogTitle>
    <form className="mt-5 grid gap-4" onSubmit={async event => {
      event.preventDefault(); if (pending) return;
      const form = new FormData(event.currentTarget);
      const input = adminUserIdentitySchema.safeParse({
        displayName: user.displayName, username: user.username, [field]: form.get(field),
        expectedDisplayName: user.displayName, expectedUsername: user.username,
      });
      if (!input.success) return void toast.error(input.error.issues[0].message);
      setPending(true);
      try {
        await managementRequest(`/admin/users/${user.id}/identity`, commandResultSchema, "PATCH", input.data);
        setOpen(false); toast.success("Usuário atualizado."); await refreshAccount(); router.refresh();
      } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível alterar o usuário."); }
      finally { setPending(false); }
    }}>
      <Field>{label}<Input name={field} defaultValue={user[field]} required minLength={field === "username" ? 3 : 1} maxLength={field === "username" ? 24 : 40} disabled={pending} autoComplete="off" /></Field>
      <Button type="submit" loading={pending}>Salvar alterações</Button>
    </form>
  </EditableRow>;
}
function UserPermissions({ user, field }: { user: AdminUser; field: "role" | "status" }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const { refreshAccount } = useSession();
  const label = field === "role" ? "Permissão" : "Status";
  return <EditableRow label={label} value={field === "role" ? roleLabel[user.role] : user.status === "active" ? "Ativo" : "Suspenso"} open={open} onOpenChange={value => { if (!pending) setOpen(value); }}>
    <DialogTitle>Editar {label.toLocaleLowerCase("pt-BR")}</DialogTitle><form className="mt-5 grid gap-4" onSubmit={async event => {
      event.preventDefault(); if (pending) return;
      const form = new FormData(event.currentTarget);
      const input = userChangeSchema.safeParse({ role: user.role, status: user.status, [field]: form.get(field), expectedRole: user.role, expectedStatus: user.status, reason: form.get("reason") });
      if (!input.success) return void toast.error(input.error.issues[0].message);
      setPending(true);
      try { await managementRequest(`/admin/users/${user.id}`, commandResultSchema, "PATCH", input.data); setOpen(false); toast.success("Usuário atualizado."); await refreshAccount(); router.refresh(); }
      catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível alterar o usuário."); }
      finally { setPending(false); }
    }}>
      {field === "role" ? <Field>Permissão<Select name="role" defaultValue={user.role} disabled={pending}><option value="user">Usuário</option><option value="admin">Administrador</option></Select></Field>
        : <Field>Status<Select name="status" defaultValue={user.status} disabled={pending}><option value="active">Ativo</option><option value="suspended">Suspenso</option></Select></Field>}
      <Field>Motivo (opcional)<Input name="reason" maxLength={256} disabled={pending} /></Field>
      <Button type="submit" loading={pending}>Salvar alterações</Button>
    </form>
  </EditableRow>;
}
export function AdminUserDetail({ initial }: { initial: ReturnType<typeof adminUserDetailSchema.parse> }) {
  const { user } = initial;
  const [transactions, setTransactions] = useState(initial.transactions);
  const [loading, setLoading] = useState(false);
  return <div className="grid gap-5">
    <Card className="flex flex-wrap items-center gap-4"><UserAvatar user={user} large /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-3"><h1 className="break-words text-xl font-semibold">{user.displayName}</h1><div className="rounded-xl bg-contrast/5 px-3 py-2 text-sm"><Balance value={user.balance} /></div></div><p className="mt-1 text-sm text-muted">@{user.username}</p></div><Status user={user} /></Card>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <Card className="grid gap-5 xl:sticky xl:top-20"><h2 className="font-semibold">Dados da conta</h2>
        <div><UserIdentity user={user} field="displayName" /><UserIdentity user={user} field="username" /><EditableRow label="Cadastro" value={adminDate(user.createdAt)} /><UserPermissions user={user} field="status" /><UserPermissions user={user} field="role" /><AdminUserBalance userId={user.id} balance={user.balance} /></div>
        <AdminUserDelete user={user} />
      </Card>
      <Card className="min-w-0"><h2 className="font-semibold">Movimentações</h2><ul className="mt-3 divide-y divide-contrast/6">{transactions.items.map(entry => <li key={entry.id} className="flex items-start justify-between gap-4 py-4"><div className="min-w-0"><p className="break-words text-sm font-medium">{entry.description}</p><p className="mt-1 text-xs text-muted">{adminDate(entry.createdAt)}</p>{entry.reference && <p className="mt-1 break-words text-xs text-muted">{entry.reference}</p>}</div><div className="shrink-0 text-right"><p className={entry.amount > 0 ? "text-sm font-semibold tabular-nums text-brand" : "text-sm font-semibold tabular-nums"}>{entry.amount > 0 ? "+" : "−"}{formatBalance.format(Math.abs(entry.amount))} Croins</p><p className="mt-1 text-xs text-muted">Saldo: {formatBalance.format(entry.balance)}</p></div></li>)}</ul>
        {!transactions.items.length && <EmptyState title="Nenhuma movimentação registrada ainda." />}
        {transactions.hasMore && <Button className="mt-4" variant="secondary" loading={loading} onClick={async () => { if (loading) return; setLoading(true); try { const next = await managementRequest(`/admin/users/${user.id}/transactions?offset=${transactions.items.length}`, transactionsSchema); setTransactions(current => ({ items: [...current.items, ...next.items], hasMore: next.hasMore })); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível carregar as movimentações."); } finally { setLoading(false); } }}>Carregar mais</Button>}
      </Card>
    </div>
    <AuditHistory targetId={user.id} initial={initial.audit} />
  </div>;
}
