"use client";

import { toast } from "sonner";
import { useEffect, useId, useState } from "react";
import { Monitor, Moon, Pencil, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AvatarSettings } from "@/features/settings/avatar-settings";
import { useDemoSession } from "@/features/auth/session-context";
import { useTheme } from "@/features/theme/theme-provider";
import Link from "next/link";
import { formatBalance } from "@/features/wallet/wallet";
import { cn } from "@/lib/utils";

const sections = ["Geral", "Aparência", "Conta", "Histórico"] as const;
const themes = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

export function SettingsDialog({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        onCloseAutoFocus={onCloseAutoFocus}
        className="flex h-[min(42rem,calc(100dvh-2rem))] w-[min(58rem,calc(100%-2rem))] flex-col overflow-hidden p-0 sm:flex-row sm:p-0"
      >
        <SettingsContent onClose={() => onOpenChange(false)} />
        <DialogClose asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="absolute top-3 right-3"
            aria-label="Fechar configurações"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

function SettingsContent({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<(typeof sections)[number]>("Geral");
  const { username, displayName, balance, walletReady, dailyClaimed } =
    useDemoSession();
  const { theme, setTheme } = useTheme();
  const panelId = useId();

  return (
    <>
      <div className="shrink-0 border-b border-contrast/6 p-3 sm:w-48 sm:border-r sm:border-b-0 sm:p-4">
        <DialogTitle className="px-3 pt-2 pb-4 text-sm font-medium">
          Configurações
        </DialogTitle>
        <nav
          aria-label="Seções de configurações"
          className="grid grid-cols-2 gap-1 sm:grid-cols-1"
        >
          {sections.map((item) => (
            <Button
              key={item}
              variant="ghost"
              size="sm"
              className={cn(
                "justify-start text-sm font-normal",
                section === item && "bg-contrast/10 text-foreground",
              )}
              aria-current={section === item ? "true" : undefined}
              aria-controls={panelId}
              onClick={() => setSection(item)}
            >
              {item}
            </Button>
          ))}
        </nav>
      </div>
      <section
        id={panelId}
        aria-label={section}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-10 sm:py-12"
        data-lenis-prevent
      >
        {section === "Geral" && (
          <dl className="divide-y divide-contrast/6 text-sm">
            <div className="flex flex-wrap justify-between gap-3 pb-5">
              <dt className="text-muted">Nome</dt>
              <dd className="break-all">{displayName}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-3 py-5">
              <dt className="text-muted">Usuário</dt>
              <dd className="break-all">@{username}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-3 py-5">
              <dt className="text-muted">Saldo atual</dt>
              <dd className="tabular-nums">
                {walletReady ? formatBalance.format(balance) : "—"} Croins
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-3 py-5">
              <dt className="text-muted">Bônus diário</dt>
              <dd>{!walletReady ? "Indisponível" : dailyClaimed ? "Aguardando próximo resgate" : "Disponível"}</dd>
            </div>
          </dl>
        )}
        {section === "Aparência" && (
          <div role="group" aria-label="Tema" className="grid gap-4">
            <p className="text-sm text-muted">Tema</p>
            <div className="grid gap-3 lg:grid-cols-3">
              {themes.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant="secondary"
                  aria-pressed={theme === value}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "min-h-16 justify-start gap-3 px-4 font-normal lg:min-h-24 lg:flex-col lg:justify-center",
                    theme === value && "bg-contrast/10 text-brand",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}
        {section === "Conta" && (
          <div className="grid gap-6">
            <AvatarSettings />
            <Card className="bg-contrast/3 px-4 py-0 sm:px-4 sm:py-0">
              <AccountIdentity />
              <AccountUsername />
            </Card>
            <DeleteAccount onDeleted={onClose} />
          </div>
        )}
        {section === "Histórico" && <Button asChild variant="secondary"><Link href="/historico" onClick={onClose}>Ver histórico de Croins</Link></Button>}
      </section>
    </>
  );
}

function AccountEditRow({ label, value, children, open, onOpenChange }: {
  label: string;
  value: string;
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-contrast/6 py-3 last:border-0">
      <span className="shrink-0 text-sm">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm text-muted">{value}</span>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${label.toLocaleLowerCase("pt-BR")}`}>
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>{children}</DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function AccountIdentity() {
  const { displayName, updateDisplayName } = useDemoSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(displayName ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <AccountEditRow label="Nome" value={displayName ?? ""} open={open} onOpenChange={value => {
      setOpen(value);
      if (value) setName(displayName ?? "");
    }}>
      <DialogTitle>Editar nome</DialogTitle>
      <form className="mt-6 grid gap-4" onSubmit={async event => {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
          await updateDisplayName(name);
          setOpen(false);
          toast.success("Nome atualizado.");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Não foi possível salvar o nome.");
        } finally { setSaving(false); }
      }}>
        <Field>Nome<Input value={name} onChange={event => setName(event.target.value)} required maxLength={40} autoComplete="nickname" disabled={saving} /></Field>
        <Button type="submit" loading={saving} disabled={saving || name.trim() === displayName}>Salvar</Button>
      </form>
    </AccountEditRow>
  );
}

function AccountUsername() {
  const { username, usernameChangeAvailableAt, updateUsername } = useDemoSession();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(username ?? "");
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!usernameChangeAvailableAt) return;
    const remaining = new Date(usernameChangeAvailableAt).getTime() - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(remaining, 2147483647));
    return () => window.clearTimeout(timer);
  }, [usernameChangeAvailableAt, now]);
  const blocked = !!usernameChangeAvailableAt && new Date(usernameChangeAvailableAt).getTime() > now;
  const availabilityId = useId();
  return (
    <AccountEditRow label="Nome de usuário" value={`@${username}`} open={open} onOpenChange={next => {
      setOpen(next);
      if (next) { setValue(username ?? ""); setNow(Date.now()); }
    }}>
      <DialogTitle>Editar nome de usuário</DialogTitle>
      <form className="mt-6 grid gap-4" onSubmit={async event => {
        event.preventDefault();
        if (saving || blocked || value.trim() === username) return;
        setSaving(true);
        try { await updateUsername(value); setOpen(false); toast.success("Usuário atualizado."); }
        catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o usuário."); }
        finally { setSaving(false); }
      }}>
        <Field>Nome de usuário
          <Input value={value} onChange={event => setValue(event.target.value)} minLength={3} maxLength={24} required
            autoComplete="username" disabled={saving || blocked} aria-describedby={blocked ? availabilityId : undefined} />
        </Field>
        {blocked && usernameChangeAvailableAt && <p id={availabilityId} className="text-sm text-muted">Você poderá alterar seu usuário novamente em {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(usernameChangeAvailableAt))}.</p>}
        <Button type="submit" loading={saving} disabled={saving || blocked || value.trim() === username}>Salvar usuário</Button>
      </form>
    </AccountEditRow>
  );
}

function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const { deleteAccount } = useDemoSession();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <Card className="flex items-center justify-between gap-4 bg-contrast/3 p-4 sm:p-4">
      <span className="text-sm">Excluir conta</span>
      <Dialog open={open} onOpenChange={next => { setOpen(next); if (!next) setPassword(""); }}>
        <DialogTrigger asChild><Button variant="destructive" size="sm">Excluir</Button></DialogTrigger>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Excluir conta permanentemente</DialogTitle>
          <form className="mt-6 grid gap-4" onSubmit={async event => {
            event.preventDefault();
            if (saving) return;
            setSaving(true);
            try { await deleteAccount(password); setPassword(""); setOpen(false); onDeleted(); toast.success("Conta excluída."); }
            catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir a conta."); }
            finally { setSaving(false); }
          }}>
            <Field>Senha atual<PasswordInput value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required maxLength={512} disabled={saving} /></Field>
            <Button type="submit" variant="destructive" loading={saving} disabled={saving || !password}>Excluir conta</Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
