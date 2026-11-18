"use client";

import { toast } from "sonner";
import { useId, useState } from "react";
import { Monitor, Moon, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AvatarSettings } from "@/features/settings/avatar-settings";
import { useDemoSession } from "@/features/auth/session-context";
import { useTheme } from "@/features/theme/theme-provider";
import { WalletHistory } from "@/features/wallet/wallet-history";
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
  const { username, displayName, balance, dailyClaimed, signOut } =
    useDemoSession();
  const { theme, setTheme } = useTheme();
  const panelId = useId();

  return (
    <>
      <div className="shrink-0 border-b border-border p-3 sm:w-48 sm:border-r sm:border-b-0 sm:p-4">
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
                section === item && "bg-control-hover text-foreground",
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
          <dl className="divide-y divide-border text-sm">
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
                {formatBalance.format(balance)} Croins
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-3 py-5">
              <dt className="text-muted">Bônus diário</dt>
              <dd>{dailyClaimed ? "Resgatado hoje" : "Disponível"}</dd>
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
                    theme === value && "bg-control-hover text-accent",
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
            <AccountIdentity key={username} />
            <div className="border-t border-border pt-6">
              <Button
                variant="secondary"
                onClick={() => {
                  onClose();
                  signOut();
                }}
              >
                Sair da conta
              </Button>
            </div>
          </div>
        )}
        {section === "Histórico" && <WalletHistory compact />}
      </section>
    </>
  );
}

function AccountIdentity() {
  const { username, displayName, updateDisplayName } = useDemoSession();
  const [name, setName] = useState(displayName ?? "");
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          updateDisplayName(name);
          setName(name.trim());
          toast.success("Nome atualizado.");
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Não foi possível salvar o nome.",
          );
        }
      }}
    >
      <Field className="font-normal text-muted">
        Nome
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={40}
          autoComplete="nickname"
        />
      </Field>
      <Field className="font-normal text-muted">
        Nome de usuário
        <Input
          value={username ?? ""}
          readOnly
          autoComplete="username"
          className="text-sm"
        />
      </Field>
      <Button
        type="submit"
        size="sm"
        className="justify-self-start"
        disabled={name.trim() === displayName}
      >
        Salvar
      </Button>
    </form>
  );
}
