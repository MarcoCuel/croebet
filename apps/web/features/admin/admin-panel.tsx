"use client";

import type { ReactNode } from "react";
import { adminRoutes, type AdminSection } from "@/features/admin/routes";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ImageIcon,
  FileText,
  Settings,
  Ticket,
  LayoutDashboard,
  PlayingCards,
  Tickets,
  Users,
  ListTree,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-context";

const sections = [
  { id: "overview", label: "Visão geral", Icon: LayoutDashboard },
  { id: "games", label: "Jogos", Icon: PlayingCards },
  { id: "markets", label: "Apostas", Icon: Tickets },
  { id: "coupons", label: "Cupons", Icon: Ticket },
  { id: "users", label: "Usuários", Icon: Users },
  { id: "pages", label: "Páginas", Icon: FileText },
  { id: "menus", label: "Menus", Icon: ListTree },
  { id: "media", label: "Mídia", Icon: ImageIcon },
  { id: "seo", label: "Configurações", Icon: Settings },
] as const;

export function AdminPanel({
  section = "overview",
  content,
}: {
  content?: ReactNode;
  section?: AdminSection;
  marketId?: string;
  pageSlug?: string;
  userId?: string;
  couponId?: string;
}) {
  const { sessionReady, permissions } = useSession();
  if (!sessionReady) return null;
  if (!permissions.canManageSite) notFound();

  return (
    <div className="min-w-0">
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
        <nav
          className="flex flex-wrap gap-1 lg:sticky lg:top-(--header-height) lg:grid lg:max-h-[calc(100dvh-var(--header-height)-2rem)] lg:overflow-y-auto"
          data-lenis-prevent
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
          {content}
        </section>
      </div>
    </div>
  );
}
