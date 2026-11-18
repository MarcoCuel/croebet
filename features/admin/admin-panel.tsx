"use client";

import { AdminCoupons, AdminCouponEditor } from "@/features/admin/admin-coupons";
import { AdminUsers, AdminUserDetail } from "@/features/admin/admin-users";
import { AdminMarkets } from "@/features/admin/admin-markets";
import { AdminMarketEditor } from "@/features/admin/admin-market-editor";
import { AdminOverview } from "@/features/admin/admin-overview";
import { AdminGames } from "@/features/admin/admin-games";
import { AdminGameEditor } from "@/features/admin/admin-game-editor";
import { adminRoutes, type AdminSection } from "@/features/admin/routes";
import { AdminPages, AdminPageEditor } from "@/features/admin/admin-pages";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileText,
  Ticket,
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
  { id: "coupons", label: "Cupons", Icon: Ticket },
  { id: "users", label: "Usuários", Icon: Users },
  { id: "pages", label: "Páginas", Icon: FileText },
] as const;

export function AdminPanel({
  section = "overview",
  gameSlug,
  marketId,
  pageSlug,
  userId,
  couponId,
}: {
  section?: AdminSection;
  gameSlug?: string;
  marketId?: string;
  pageSlug?: string;
  userId?: string;
  couponId?: string;
}) {
  const { ready, error } = useSiteConfig();
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
          {section === "overview" && <AdminOverview />}
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
          {section === "coupons" && (couponId ? <AdminCouponEditor key={couponId} id={couponId} /> : <AdminCoupons />)}
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
