"use client";

import { AdminMarkets } from "@/features/admin/admin-markets";
import { AdminMarketEditor } from "@/features/admin/admin-market-editor";
import { creditLocalWallet } from "@/features/betting/betting-storage";
import { acceptsPredictions } from "@/features/betting/settlement";
import { AdminGames } from "@/features/admin/admin-games";
import { AdminGameEditor } from "@/features/admin/admin-game-editor";
import { adminRoutes, type AdminSection } from "@/features/admin/routes";
import { AboutEditor } from "@/features/admin/about-editor";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Coins,
  FileText,
  LayoutDashboard,
  PlayingCards,
  Tickets,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useDemoSession } from "@/features/auth/session-context";
import { formatBalance } from "@/features/wallet/wallet";
import { useSiteConfig } from "@/features/admin/site-config";

const sections = [
  { id: "overview", label: "Visão geral", Icon: LayoutDashboard },
  { id: "games", label: "Jogos", Icon: PlayingCards },
  { id: "markets", label: "Apostas", Icon: Tickets },
  { id: "about", label: "Sobre", Icon: FileText },
  { id: "balance", label: "Saldo", Icon: Coins },
] as const;
const text = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim();

export function AdminPanel({
  section = "overview",
  gameSlug,
  marketId,
}: {
  section?: AdminSection;
  gameSlug?: string;
  marketId?: string;
}) {
  const { config, ready, error } = useSiteConfig();
  const { sessionReady, permissions } = useDemoSession();
  if (!sessionReady) return null;
  if (!permissions.canManageSite) notFound();
  if (!ready) return <p role="status">Carregando painel…</p>;
  if (error) return <Card role="alert">{error}</Card>;

  return (
    <div className="min-w-0">
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav
          className="flex flex-wrap gap-1 lg:grid"
          aria-label="Seções do admin"
        >
          {sections.map(({ id, label, Icon }) => (
            <Button
              key={id}
              variant={section === id ? "secondary" : "ghost"}
              className="justify-start"
              aria-current={section === id ? "page" : undefined}
              asChild
            >
              <Link href={adminRoutes[id]}>
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            </Button>
          ))}
        </nav>
        <section
          className="min-w-0"
          aria-label={sections.find((s) => s.id === section)?.label}
        >
          {section === "overview" && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  [
                    "Jogos ativos",
                    config.games.filter((g) => g.enabled).length,
                  ],
                  [
                    "Apostas abertas",
                    config.markets.filter((m) => acceptsPredictions(m)).length,
                  ],
                  ["Páginas editáveis", 1],
                ].map(([label, count]) => (
                  <Card key={label} className="p-5">
                    <p className="text-sm text-muted">{label}</p>
                    <p className="mt-2 text-3xl font-semibold">{count}</p>
                  </Card>
                ))}
              </div>
              <Card className="mt-5">
                <h2 className="font-semibold">A casa está sob seu comando</h2>
                <p className="mt-2 text-sm text-muted">
                  Edite o catálogo, abra ou pause apostas, atualize o Sobre e
                  adicione Croins às contas locais.
                </p>
                <Button asChild variant="link" className="mt-3 px-0">
                  <Link href="/">Ver site</Link>
                </Button>
              </Card>
            </>
          )}
          {section === "games" &&
            (gameSlug ? (
              <AdminGameEditor key={gameSlug} slug={gameSlug} />
            ) : (
              <AdminGames />
            ))}
          {section === "markets" &&
            (marketId ? (
              <AdminMarketEditor key={marketId} id={marketId} />
            ) : (
              <AdminMarkets />
            ))}
          {section === "about" && (
            <Card>
              <h2 className="mb-5 text-lg font-semibold">Página Sobre</h2>
              <AboutEditor />
            </Card>
          )}
          {section === "balance" && <AdminBalance />}
        </section>
      </div>
    </div>
  );
}

function AdminBalance() {
  const { username, balance, permissions } = useDemoSession();
  return (
    <Card>
      <h2 className="text-lg font-semibold">Adicionar saldo</h2>
      <p className="mt-2 text-sm text-muted">
        Croins fictícios. Sua conta: {formatBalance.format(balance)} Croins.
        Informe uma conta que já tenha acessado neste navegador.
      </p>
      <form
        className="mt-5 grid max-w-lg gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!permissions.canManageSite) return;
          const element = event.currentTarget;
          const form = new FormData(element);
          const target = text(form, "username");
          const amount = Number(form.get("amount"));
          try {
            await creditLocalWallet(target, amount);
            element.reset();
            toast.success(`${amount} Croins adicionados a ${target}.`);
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Não foi possível atualizar o saldo.",
            );
          }
        }}
      >
        <Field>
          Nome de usuário
          <Input
            name="username"
            defaultValue={username ?? ""}
            required
            maxLength={100}
          />
        </Field>
        <Field>
          Adicionar Croins de teste
          <Input
            type="number"
            name="amount"
            min={1}
            max={999999}
            step={1}
            required
          />
        </Field>
        <Button type="submit" className="justify-self-start">
          Adicionar
        </Button>
      </form>
    </Card>
  );
}
