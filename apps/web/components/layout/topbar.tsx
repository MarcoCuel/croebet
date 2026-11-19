"use client";

import { ChevronLeft, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useDemoSession } from "@/features/auth/session-context";
import { AccountMenu } from "@/features/auth/account-menu";
import { Balance } from "@/features/wallet/balance";
import { RedeemButton } from "@/features/wallet/redeem-button";
import { Button } from "@/components/ui/button";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { brandLinkClass, Wordmark } from "./brand";
import { adminRoutes } from "@/features/admin/routes";
import { useSiteConfig } from "@/features/admin/site-config";
import { useHomeSection } from "@/features/home/home-section";
import { usePageBack } from "./page-back";
import { cn } from "@/lib/utils";

export function Topbar({
  mobileMenuOpen,
  onOpenMenu,
}: {
  mobileMenuOpen: boolean;
  onOpenMenu: () => void;
}) {
  const pathname = usePathname();
  const {
    config: { games, pages },
  } = useSiteConfig();
  const { section, setSection } = useHomeSection();
  const isBets = section === "bets";
  const { permissions } = useDemoSession();
  const pageAction = permissions.canManageSite
    ? ({
        [adminRoutes.coupons]: { href: "/admin/cupons/novo", label: "Novo cupom" },
        [adminRoutes.pages]: { href: "/admin/paginas/nova", label: "Nova página" },
        [adminRoutes.markets]: { href: "/admin/apostas/nova", label: "Nova aposta" },
      } as Record<string, { href: string; label: string }>)[pathname]
    : undefined;
  const pageTitle =
    (pathname.startsWith("/admin/") && permissions.canManageSite
      ? pathname.startsWith("/admin/cupons/")
        ? pathname.endsWith("/novo") ? "Novo cupom" : "Gerenciar cupom"
        : pathname.startsWith("/admin/usuarios/")
        ? "Usuário"
        : pathname.startsWith("/admin/apostas/")
        ? pathname.endsWith("/nova")
          ? "Nova aposta"
          : "Gerenciar aposta"
        : pathname.startsWith("/admin/paginas/")
          ? pathname.endsWith("/nova") ? "Nova página" : "Editar página"
        : pathname.startsWith("/admin/jogos/")
          ? "Editar jogo"
          : (
              {
                "/admin/cupons": "Cupons",
                "/admin/jogos": "Jogos",
                "/admin/apostas": "Apostas",
                "/admin/paginas": "Páginas",
                "/admin/usuarios": "Usuários",
              } as Record<string, string>
            )[pathname]
      : undefined) ??
    pages.find((page) => page.published && pathname === `/${page.slug}`)?.title ??
    games.find((game) => pathname === `/jogos/${game.slug}`)?.name ??
    (
      {
        "/admin": permissions.canManageSite ? "Admin" : "Página não encontrada",
        "/jogos": "Jogos",
        "/apostas": "Apostas",
        "/rankings": "Rankings",
        "/conquistas": "Conquistas",
        "/historico": "Histórico",
      } as Record<string, string>
    )[pathname] ??
    (pathname === "/perfil" || pathname.startsWith("/perfil/") ? "Perfil" : "Página não encontrada");
  const isInternalPage = pathname !== "/";
  const backLink =
    pathname.startsWith("/admin/") && permissions.canManageSite
      ? pathname.startsWith("/admin/cupons/")
        ? { href: adminRoutes.coupons, label: "Voltar para Cupons do admin" }
        : pathname.startsWith("/admin/usuarios/")
        ? { href: adminRoutes.users, label: "Voltar para Usuários do admin" }
        : pathname.startsWith("/admin/apostas/")
        ? { href: adminRoutes.markets, label: "Voltar para Apostas do admin" }
        : pathname.startsWith("/admin/paginas/")
          ? { href: adminRoutes.pages, label: "Voltar para Páginas do admin" }
        : pathname.startsWith("/admin/jogos/")
          ? { href: adminRoutes.games, label: "Voltar para Jogos do admin" }
          : { href: "/admin", label: "Voltar para Admin" }
      : pathname.startsWith("/jogos/")
        ? { href: "/jogos", label: "Voltar para Jogos" }
        : { href: "/", label: "Voltar para o início" };
  const {
    username,
    sessionReady,
    balance,
    walletReady,
    openLogin,
    openRegister,
  } = useDemoSession();
  return (
    <header className="fixed top-0 right-0 left-(--sidebar-width) z-20 flex h-(--header-height) items-center justify-between gap-2 bg-background px-(--page-gap) transition-[left,padding-left] duration-300 ease-in-out motion-reduce:transition-none md:group-data-[sidebar=collapsed]/navigation:pl-16 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="size-10 md:hidden"
          aria-label="Abrir menu"
          aria-haspopup="dialog"
          aria-expanded={mobileMenuOpen}
          onClick={onOpenMenu}
        >
          <Menu className="size-4" aria-hidden="true" />
        </Button>
        <Link
          className={cn(
            brandLinkClass,
            isInternalPage ? "hidden" : "text-xl md:hidden",
          )}
          href="/"
          aria-label="Croebet, início"
        >
          <Wordmark />
        </Link>
        {isInternalPage && (
          <Suspense fallback={<BackButton backLink={backLink} />}>
            <MatchBackButton pathname={pathname} backLink={backLink} />
          </Suspense>
        )}
        {isInternalPage ? (
          <>
            <span className="truncate text-sm font-medium md:text-base">
              {pageTitle}
            </span>
            {pageAction && (
              <Button asChild variant="secondary" size="sm">
                <Link href={pageAction.href}>{pageAction.label}</Link>
              </Button>
            )}
          </>
        ) : (
          <nav
            className="hidden items-center gap-1 rounded-panel bg-contrast/6 p-1.5 md:flex"
            aria-label="Seções da Croebet"
          >
            <Button
              variant={isBets ? "ghost" : "default"}
              size="sm"
              className={cn("text-sm", isBets && "font-normal")}
              aria-pressed={!isBets}
              onClick={() => setSection("casino")}
            >
              Jogos
            </Button>
            <Button
              variant={isBets ? "default" : "ghost"}
              size="sm"
              className={cn("text-sm", !isBets && "font-normal")}
              aria-pressed={isBets}
              onClick={() => setSection("bets")}
            >
              Apostas
            </Button>
          </nav>
        )}
      </div>
      {!sessionReady ? (
        <div role="status" aria-label="Carregando conta" className="col-start-3 h-11 w-36 justify-self-end rounded-panel bg-contrast/6 motion-safe:animate-pulse" />
      ) : username ? (
        <>
          <div className="hidden items-center gap-2 rounded-panel bg-contrast/6 p-1.5 md:flex">
            <Button
              asChild
              variant="ghost"
              className="min-h-0 min-w-0 shrink px-0.5 py-0 font-normal text-foreground"
            >
              <Link href="/historico" aria-label="Ver histórico de Croins">
                <Balance value={walletReady ? balance : null} />
              </Link>
            </Button>
            <RedeemButton />
          </div>
          <div className="flex min-w-0 items-center justify-self-end gap-2">
            <Button
              asChild
              variant="secondary"
              className="min-w-0 shrink px-2 font-normal md:hidden"
            >
              <Link href="/historico" aria-label="Ver histórico de Croins">
                <Balance value={walletReady ? balance : null} />
              </Link>
            </Button>
            <div className="hidden md:block">
              <NotificationsMenu />
            </div>
            <AccountMenu name={username} />
          </div>
        </>
      ) : (
        <div className="col-start-3 flex shrink-0 justify-self-end gap-1.5 sm:gap-2">
          <Button
            variant="secondary"
            className="px-2.5 text-xs sm:px-4 sm:text-sm"
            aria-haspopup="dialog"
            onClick={openLogin}
          >
            Entrar
          </Button>
          <Button
            className="px-2.5 text-xs sm:px-4 sm:text-sm"
            aria-haspopup="dialog"
            onClick={openRegister}
          >
            Criar conta
          </Button>
        </div>
      )}
    </header>
  );
}

type BackLink = { href: string; label: string };

function MatchBackButton({ pathname, backLink }: { pathname: string; backLink: BackLink }) {
  const searchParams = useSearchParams();
  const destination = pathname === "/jogos/flip7" && searchParams.has("partida")
    ? { href: "/jogos/flip7", label: "Voltar para Flip7" }
    : backLink;
  return <BackButton backLink={destination} />;
}

function BackButton({ backLink }: { backLink: BackLink }) {
  const { requestBack } = usePageBack();
  return (
    <Button asChild variant="ghost" size="icon" className="hidden shrink-0 md:inline-flex">
      <Link
        href={backLink.href}
        aria-label={backLink.label}
        onClick={(event) => {
          if (
            !event.metaKey &&
            !event.ctrlKey &&
            !event.shiftKey &&
            !event.altKey &&
            event.button === 0 &&
            requestBack(backLink.href)
          ) event.preventDefault();
        }}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Link>
    </Button>
  );
}
