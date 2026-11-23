"use client";

import { ChevronLeft, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { LobbyInvitations } from "@croebet/shared";
import { useSession } from "@/features/auth/session-context";
import { AccountMenu } from "@/features/auth/account-menu";
import { Balance } from "@/features/wallet/balance";
import { RedeemButton } from "@/features/wallet/redeem-button";
import { DailyBonusButton } from "@/features/wallet/daily-bonus-button";
import { Button } from "@/components/ui/button";
import { ActiveMatchesMenu } from "@/features/games/active-matches-menu";
import { GeneralChat } from "@/features/chat/general-chat";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { brandLinkClass, Wordmark } from "./brand";
import { adminRoutes } from "@/features/admin/routes";
import { gameUrl } from "@/features/games/game-url";
import { useGameLinks } from "@/features/games/game-links";
import { MatchNavbarControls, MatchNavbarIdentity, useMatchNavbar } from "./match-navbar";
import { usePageBack } from "./page-back";
import { cn } from "@/lib/utils";
import { usePageLinks } from "@/features/pages/page-links";

export function Topbar({
  mobileMenuOpen,
  onOpenMenu,
  invitations,
}: {
  mobileMenuOpen: boolean;
  onOpenMenu: () => void;
  invitations: LobbyInvitations["items"];
}) {
  const matchNavbar = useMatchNavbar();
  const compactMatch = matchNavbar?.active && matchNavbar.hasHeader;
  const pathname = usePathname();
  const games = useGameLinks();
  const pages = usePageLinks() ?? [];
  const { permissions } = useSession();
  const pageTitle =
    (pathname.startsWith("/admin/") && permissions.canManageSite
      ? pathname.startsWith("/admin/conquistas/")
        ? pathname.endsWith("/nova") ? "Criar conquista" : "Editar conquista"
        : pathname.startsWith("/admin/cupons/")
        ? pathname.endsWith("/novo") ? "Novo cupom" : "Gerenciar cupom"
        : pathname.startsWith("/admin/usuarios/")
        ? "Usuário"
        : pathname.startsWith("/admin/apostas/")
        ? pathname.endsWith("/nova")
          ? "Nova aposta"
          : "Gerenciar aposta"
        : pathname.startsWith("/admin/paginas/")
          ? pathname.endsWith("/nova") ? "Nova página" : "Editar página"
        : pathname === "/admin/jogos/laboratorio"
          ? "Laboratório de jogos"
        : pathname === "/admin/jogos/laboratorio/love-letter"
          ? "Cartas do Love Letter"
        : pathname.startsWith("/admin/jogos/")
          ? pathname.endsWith("/novo") ? "Criar jogo" : "Editar jogo"
          : (
              {
                [adminRoutes.seo]: "Configurações",
                "/admin/cupons": "Cupons",
                [adminRoutes.achievements]: "Conquistas",
                "/admin/jogos": "Jogos",
                "/admin/apostas": "Apostas",
                "/admin/paginas": "Páginas",
                "/admin/menus": "Menus",
                [adminRoutes.media]: "Biblioteca de mídia",
                "/admin/usuarios": "Usuários",
              } as Record<string, string>
            )[pathname]
      : undefined) ??
    pages.find((page) => pathname === `/${page.slug}`)?.title ??
    games.find((game) => pathname === `/jogos/${game.slug}`)?.name ??
    (
      {
        "/admin": permissions.canManageSite ? "Admin" : "Página não encontrada",
        "/jogos": "Jogos",
        "/apostas": "Apostas",
        "/rankings": "Rankings",
        "/conquistas": "Conquistas",
        "/carteira": "Carteira",
      } as Record<string, string>
    )[pathname] ??
    (pathname === "/perfil" || pathname.startsWith("/perfil/") ? "Perfil" : "Página não encontrada");
  const isInternalPage = pathname !== "/";
  const backLink =
    pathname.startsWith("/admin/") && permissions.canManageSite
      ? pathname.startsWith("/admin/conquistas/")
        ? { href: adminRoutes.achievements, label: "Voltar para Conquistas do admin" }
        : pathname.startsWith("/admin/cupons/")
        ? { href: adminRoutes.coupons, label: "Voltar para Cupons do admin" }
        : pathname.startsWith("/admin/usuarios/")
        ? { href: adminRoutes.users, label: "Voltar para Usuários do admin" }
        : pathname.startsWith("/admin/apostas/")
        ? { href: adminRoutes.markets, label: "Voltar para Apostas do admin" }
        : pathname.startsWith("/admin/paginas/")
          ? { href: adminRoutes.pages, label: "Voltar para Páginas do admin" }
        : pathname === "/admin/jogos/laboratorio/love-letter"
          ? { href: "/admin/jogos/laboratorio", label: "Voltar ao laboratório" }
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
  } = useSession();
  return (
    <header className={cn("fixed top-0 right-(--chat-width) left-(--sidebar-width) z-20 flex h-(--header-height) items-center justify-between gap-2 bg-linear-to-b from-background to-transparent px-(--page-gap) transition-[left,right,padding-left] duration-300 ease-in-out motion-reduce:transition-none md:group-data-[sidebar=collapsed]/navigation:pl-16 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]", compactMatch && "md:flex")}>
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
        {isInternalPage && (
          <>
            <span className={cn("truncate text-sm font-medium md:text-base", compactMatch && "shrink-0")}>
              {pageTitle}
            </span>
            <MatchNavbarIdentity />

          </>
        )}
      </div>
      {!sessionReady ? (
        <div role="status" aria-label="Carregando conta" className="col-start-3 h-11 w-36 justify-self-end rounded-panel bg-contrast/6 motion-safe:animate-pulse" />
      ) : username ? (
        <>
          <div className={cn("hidden items-center gap-1 rounded-panel bg-contrast/6 p-1.5 md:flex backdrop-blur-2xl", compactMatch && "md:hidden 2xl:flex")}>
            <Button
              asChild
              variant="ghost"
              className="min-h-0 min-w-0 shrink p-1 pr-4 font-normal text-foreground backdrop-blur-none"
            >
              <Link href="/carteira" aria-label="Ver carteira">
                <Balance key={username} value={walletReady ? balance : null} showCurrency />
              </Link>
            </Button>
            <RedeemButton />
          </div>
          <div className="flex shrink-0 items-center justify-self-end gap-2">
            <MatchNavbarControls />
            <div className="hidden md:contents"><DailyBonusButton /></div>
            <Suspense><ActiveMatchesMenu /></Suspense>
            <div className="hidden md:contents">
              <NotificationsMenu invitations={invitations} />
            </div>
            <GeneralChat />
            <AccountMenu name={username} />
          </div>
        </>
      ) : (
        <div className="col-start-3 flex shrink-0 justify-self-end gap-1.5 sm:gap-2">
          <MatchNavbarControls />
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
  const games = useGameLinks();
  const game = games.find((item) => pathname === `/jogos/${item.slug}`);
  const destination = pathname.startsWith("/jogos/") && searchParams.has("partida")
    ? { href: gameUrl(pathname.slice("/jogos/".length),{development:searchParams.get("teste")==="1"}), label: `Voltar para ${game?.name ?? "o jogo"}` }
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
