"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/search-input";
import {
  exampleUsers,
  examplePredictions,
  getExampleActivity,
  userStatuses,
  type ExampleUser,
  type UserStatus,
} from "@/features/admin/user-fixtures";
import { formatBalance } from "@/features/wallet/wallet";
import { useDemoSession } from "@/features/auth/session-context";
import { AdminUserBalance } from "@/features/admin/admin-user-balance";
import { cn } from "@/lib/utils";

type AdminUser = Omit<ExampleUser, "games" | "wins" | "joined" | "lastSeen"> & {
  games?: number;
  wins?: number;
  joined?: string;
  lastSeen?: string;
  avatar?: string | null;
};
function useCurrentAdminUser(): AdminUser {
  const { username, displayName, balance, predictions, avatar } =
    useDemoSession();
  return {
    id: "minha-conta",
    name: displayName ?? username ?? "",
    username: username ?? "",
    role: "Administrador",
    status: "active",
    balance,
    bets: predictions.length,
    avatar,
  };
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value.length === 10 ? `${value}T12:00:00-03:00` : value));

function UserAvatar({
  user,
  large = false,
}: {
  user: AdminUser;
  large?: boolean;
}) {
  return (
    <Avatar className={large ? "size-16" : "size-10"} aria-hidden="true">
      {user.avatar && <AvatarImage src={user.avatar} alt="" />}
      <AvatarFallback className={large ? "text-lg" : undefined}>
        {user.name
          .split(" ")
          .slice(0, 2)
          .map((word) => word[0])
          .join("")}
      </AvatarFallback>
    </Avatar>
  );
}

function UserStatusBadge({ status }: { status: UserStatus }) {
  return (
    <Badge
      variant="secondary"
      className={
        status === "active"
          ? "bg-prediction-yes/10 text-prediction-yes"
          : "bg-prediction-no/10 text-prediction-no"
      }
    >
      {userStatuses[status]}
    </Badge>
  );
}

export function AdminUsers() {
  const currentUser = useCurrentAdminUser();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UserStatus | "all">("all");
  const users = [currentUser, ...exampleUsers].filter(
    (user) =>
      (status === "all" || user.status === status) &&
      normalize(`${user.name} ${user.username}`).includes(normalize(search.trim())),
  );
  return (
    <div>
      <h1 className="sr-only">Usuários</h1>
      <SearchInput
        aria-label="Buscar usuários no admin"
        placeholder="Buscar por nome ou usuário"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="my-4 flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Status dos usuários"
        >
          {(
            [
              ["all", "Todos"],
              ["active", "Ativos"],
              ["suspended", "Suspensos"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={status === value ? "secondary" : "ghost"}
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted" role="status">
          {users.length} {users.length === 1 ? "usuário" : "usuários"}
        </p>
      </div>
      <Card className="overflow-hidden p-0 sm:p-0">
        <div
          aria-hidden="true"
          className="hidden grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_2rem] items-center gap-4 px-5 py-4 text-xs text-muted xl:grid"
        >
          <span>Usuário</span>
          <span>Permissão</span>
          <span>Status</span>
          <span>Saldo</span>
          <span />
        </div>
        <ul className="divide-y divide-border">
          {users.map((user) => (
            <li key={user.id}>
              <Link
                href={`/admin/usuarios/${user.id}`}
                aria-label={`Ver usuário ${user.username}`}
                className="grid grid-cols-2 items-center gap-3 p-5 transition-colors hover:bg-contrast/10 motion-reduce:transition-none xl:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_2rem]"
              >
                <div className="col-span-2 flex min-w-0 items-center gap-3 xl:col-span-1">
                  <UserAvatar user={user} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {user.name}
                    </p>
                    <p className="truncate text-xs text-muted">@{user.username}</p>
                  </div>
                </div>
                <span className="text-sm text-muted">{user.role}</span>
                <UserStatusBadge status={user.status} />
                <span className="col-span-2 text-sm font-medium tabular-nums xl:col-span-1">
                  {formatBalance.format(user.balance)}{" "}
                  <span className="text-xs font-normal text-muted">Croins</span>
                </span>
                <ArrowUpRight
                  className="hidden size-4 justify-self-end text-muted xl:block"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
        {users.length === 0 && (
          <p className="p-6 text-sm text-muted">Nenhum usuário encontrado.</p>
        )}
      </Card>
    </div>
  );
}

export function AdminUserDetail({ id }: { id: string }) {
  const currentUser = useCurrentAdminUser();
  const session = useDemoSession();
  const isCurrentUser = id === currentUser.id;
  const fixture = exampleUsers.find((item) => item.id === id);
  const user: AdminUser | undefined = isCurrentUser ? currentUser : fixture;
  const [tab, setTab] = useState<"activity" | "bets">("activity");
  if (!user) notFound();
  const activity = isCurrentUser
    ? session.transactions.map((item) => ({
        ...item,
        title: item.description,
        detail: new Intl.DateTimeFormat("pt-BR", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "America/Sao_Paulo",
        }).format(new Date(item.createdAt)),
      }))
    : getExampleActivity(fixture!);
  const predictions = isCurrentUser
    ? session.predictions.map((item) => ({
        question: item.market,
        choice: item.outcome,
        amount: item.stake,
        status: (
          {
            pending: "Em aberto",
            won: "Ganhou",
            lost: "Perdeu",
            refunded: "Devolvida",
          } as const
        )[item.status ?? "pending"],
      }))
    : examplePredictions;
  return (
    <div className="grid gap-5">
      <Card className="flex flex-wrap items-center gap-4">
        <UserAvatar user={user} large />
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-xl font-semibold">{user.name}</h1>
          <p className="mt-1 text-sm text-muted">@{user.username}</p>
        </div>
        <UserStatusBadge status={user.status} />
      </Card>
      <dl className="grid grid-cols-2 gap-4 2xl:grid-cols-4">
        {[
          ["Saldo em Croins", formatBalance.format(user.balance)],
          ["Jogos disputados", user.games],
          ["Apostas realizadas", user.bets],
          ["Vitórias nos jogos", user.wins],
        ].map(([label, value]) => (
          <Card key={label} className="min-w-0 p-4 sm:p-5">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums">
              {value ?? "—"}
            </dd>
            {label === "Saldo em Croins" && isCurrentUser && (
              <dd>
                <AdminUserBalance />
              </dd>
            )}
          </Card>
        ))}
      </dl>
      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="min-w-0 2xl:sticky 2xl:top-[calc(var(--header-height)+1rem)]">
          <h2 className="font-semibold">Dados da conta</h2>
          <dl className="mt-5 grid gap-5 text-sm">
            {[
              ["Nome", user.name],
              ["Permissão", user.role],
              ["Cadastro", user.joined ? date(user.joined) : "—"],
              ["Último acesso", user.lastSeen ? date(user.lastSeen) : "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="mt-1 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="min-w-0">
          <div
            className="mb-3 flex flex-wrap gap-1"
            role="group"
            aria-label="Histórico do usuário"
          >
            <Button
              size="sm"
              variant={tab === "activity" ? "secondary" : "ghost"}
              aria-pressed={tab === "activity"}
              onClick={() => setTab("activity")}
            >
              Movimentações
            </Button>
            <Button
              size="sm"
              variant={tab === "bets" ? "secondary" : "ghost"}
              aria-pressed={tab === "bets"}
              onClick={() => setTab("bets")}
            >
              Apostas
            </Button>
          </div>
          <h2 className="sr-only">
            {tab === "activity" ? "Movimentações recentes" : "Apostas recentes"}
          </h2>
          {tab === "activity" ? (
            <ul className="divide-y divide-border">
              {activity.length === 0 && (
                <li className="py-4 text-sm text-muted">
                  Nenhuma movimentação registrada ainda.
                </li>
              )}
              {activity.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-4 py-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-muted">{item.detail}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        item.amount > 0
                          ? "text-prediction-yes"
                          : "text-prediction-no",
                      )}
                    >
                      {item.amount > 0 ? "+" : ""}
                      {formatBalance.format(item.amount)}{" "}
                      <span className="text-xs">Croins</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Saldo: {formatBalance.format(item.balance)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y divide-border">
              {predictions.length === 0 && (
                <li className="py-4 text-sm text-muted">
                  Nenhuma aposta registrada ainda.
                </li>
              )}
              {predictions.map((bet, index) => (
                <li key={index} className="grid gap-2 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 text-sm font-medium">
                      {bet.question}
                    </p>
                    <Badge variant="secondary">{bet.status}</Badge>
                  </div>
                  <p className="text-xs text-muted">
                    {bet.choice} · {formatBalance.format(bet.amount)} Croins
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
