"use client";

import { AdminUsers, AdminUserDetail } from "@/features/admin/admin-users";
import { AdminMarkets } from "@/features/admin/admin-markets";
import { AdminMarketEditor } from "@/features/admin/admin-market-editor";
import { acceptsPredictions } from "@/features/betting/settlement";
import { AdminGames } from "@/features/admin/admin-games";
import { AdminGameEditor } from "@/features/admin/admin-game-editor";
import { adminRoutes, type AdminSection } from "@/features/admin/routes";
import { AdminPages, AdminPageEditor } from "@/features/admin/admin-pages";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileText,
  LayoutDashboard,
  PlayingCards,
  Tickets,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useDemoSession } from "@/features/auth/session-context";
import { useSiteConfig } from "@/features/admin/site-config";

const sections = [
  { id: "overview", label: "Visão geral", Icon: LayoutDashboard },
  { id: "games", label: "Jogos", Icon: PlayingCards },
  { id: "markets", label: "Apostas", Icon: Tickets },
  { id: "users", label: "Usuários", Icon: Users },
  { id: "pages", label: "Páginas", Icon: FileText },
] as const;

export function AdminPanel({
  section = "overview",
  gameSlug,
  marketId,
  pageSlug,
  userId,
}: {
  section?: AdminSection;
  gameSlug?: string;
  marketId?: string;
  pageSlug?: string;
  userId?: string;
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
                  ["Páginas editáveis", config.pages.length],
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
                  Edite o catálogo, abra ou pause apostas, atualize as páginas e
                  gerencie os Croins da sua conta.
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
          {section === "pages" &&
            (pageSlug ? (
              <AdminPageEditor key={pageSlug} slug={pageSlug} />
            ) : (
              <AdminPages />
            ))}
          {section === "users" &&
            (userId ? (
              <AdminUserDetail key={userId} id={userId} />
            ) : (
              <AdminUsers />
            ))}
        </section>
      </div>
    </div>
  );
}
