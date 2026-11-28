"use client";

import { ChevronLeft, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { onlineCountSchema, type LobbyInvitations } from "@croebet/shared";
import { useSession } from "@/features/auth/session-context";
import { AccountMenu } from "@/features/auth/account-menu";
import { Balance } from "@/features/wallet/balance";
import { RedeemButton } from "@/features/wallet/redeem-button";
import { DailyBonusButton } from "@/features/wallet/daily-bonus-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActiveMatchesMenu } from "@/features/games/active-matches-menu";
import { GeneralChat } from "@/features/chat/general-chat";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { brandLinkClass, Wordmark } from "./brand";
import { adminRoutes } from "@/features/admin/routes";
import { gameUrl } from "@/features/games/game-url";
import { useGameLinks } from "@/features/games/game-links";
import {
  MatchNavbarControls,
  MatchNavbarIdentity,
  useMatchNavbar,
} from "./match-navbar";
import { usePageBack } from "./page-back";
import { cn } from "@/lib/utils";
import { usePageLinks } from "@/features/pages/page-links";
import { realtimeSocket, retainRealtimeSocket } from "@/lib/realtime";

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
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  const {
    permissions,
    userId,
    username,
    sessionReady,
    balance,
    walletReady,
    openLogin,
    openRegister,
  } = useSession();

  useEffect(() => {
    if (!sessionReady) return;
    const desktop = window.matchMedia("(min-width: 48rem)");
    let stop: (() => void) | undefined;
    const update = () => {
      stop?.();
      const socket = realtimeSocket();
      const receive = (value: unknown) => {
        const result = onlineCountSchema.safeParse(value);
        if (result.success) setOnlineCount(result.data);
      };
      socket.on("online-count", receive);
      const release =
        pathname === "/" && desktop.matches
          ? retainRealtimeSocket(userId)
          : undefined;
      stop = () => {
        socket.off("online-count", receive);
        release?.();
      };
    };
    update();
    desktop.addEventListener("change", update);
    return () => {
      desktop.removeEventListener("change", update);
      stop?.();
    };
  }, [pathname, sessionReady, userId]);

  const game = games.find((item) => pathname === `/jogos/${item.slug}`);

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
                [adminRoutes.extras]: "Extras",
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
    game?.name ??
    (
      {
        "/admin": permissions.canManageSite ? "Admin" : "Página não encontrada",
        "/chat": "Chat geral",
        "/jogos": "Jogos",
        "/apostas": "Apostas",
        "/rankings": "Rankings",
        "/conquistas": "Conquistas",
        "/carteira": "Carteira",
      } as Record<string, string>
    )[pathname] ??
    (pathname === "/perfil" || pathname.startsWith("/perfil/")
      ? "Perfil"
      : "Página não encontrada");

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

  return (
    <header
      className={cn(
        "fixed top-0 right-0 left-(--sidebar-width) z-20 flex h-(--header-height) items-center justify-between gap-2 bg-linear-to-b from-background to-transparent px-(--page-gap) transition-[left,padding-left] duration-300 ease-in-out motion-reduce:transition-none md:group-data-[sidebar=collapsed]/navigation:pl-16 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]",
        compactMatch && "md:flex",
      )}
    >
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

        {!isInternalPage && (
          <div className="hidden items-center gap-2 whitespace-nowrap text-sm text-muted md:flex">
            <NotificationsMenu invitations={invitations} />

            <div
              role="status"
              aria-label="Usuários online"
              className="hidden items-center gap-2 whitespace-nowrap text-sm text-muted md:flex"
            >
              {onlineCount === null ? (
                <Skeleton className="h-4 w-16" />
              ) : (
                <>
                  <span
                    className="size-2 shrink-0 rounded-full bg-tertiary"
                    aria-hidden="true"
                  />
                  <span className="tabular-nums">{onlineCount} online</span>
                </>
              )}
            </div>
          </div>
        )}

        {isInternalPage && (
          <Suspense fallback={<BackButton backLink={backLink} />}>
            <MatchBackButton
              pathname={pathname}
              backLink={backLink}
            />
          </Suspense>
        )}

        {isInternalPage && (
          <>
            {/* {game && (
              <GameCover
                imageUrl={game.imageUrl}
                name={game.name}
                className="size-11 shrink-0 rounded-md mr-2"
                iconClassName="size-4"
              />
            )} */}

            <span
              className={cn(
                "truncate text-sm font-medium md:text-base",
                compactMatch && "md:shrink-0",
              )}
            >
              {pageTitle}
            </span>

            <MatchNavbarIdentity />
          </>
        )}
      </div>

      {!sessionReady ? (
        <div
          role="status"
          aria-label="Carregando conta"
          className="col-start-3 h-11 w-36 justify-self-end rounded-panel bg-contrast/6 motion-safe:animate-pulse"
        />
      ) : username ? (
        <>
          <div
            className={cn(
              "hidden items-center gap-1 rounded-panel bg-contrast/6 p-1.5 md:flex backdrop-blur-2xl",
              compactMatch && "md:hidden 2xl:flex",
            )}
          >
            <Button
              asChild
              variant="flat"
              className="min-h-0 min-w-0 shrink p-1 pr-4 font-normal text-foreground"
            >
              <Link href="/carteira" aria-label="Ver carteira">
                <Balance
                  key={username}
                  value={walletReady ? balance : null}
                  showCurrency
                />
              </Link>
            </Button>

            <RedeemButton />
          </div>

          <div className="flex shrink-0 items-center justify-self-end gap-2">
            <MatchNavbarControls />

            <Suspense>
              <ActiveMatchesMenu />
            </Suspense>

            <div className="hidden lg:contents">
              <GeneralChat />
            </div>

            <AccountMenu name={username} />

            <div className="hidden md:contents">
              <DailyBonusButton />
            </div>
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

type BackLink = {
  href: string;
  label: string;
};

function MatchBackButton({
  pathname,
  backLink,
}: {
  pathname: string;
  backLink: BackLink;
}) {
  const searchParams = useSearchParams();
  const games = useGameLinks();

  const game = games.find(
    (item) => pathname === `/jogos/${item.slug}`,
  );

  const destination =
    pathname.startsWith("/jogos/") && searchParams.has("partida")
      ? {
          href: gameUrl(pathname.slice("/jogos/".length), {
            development: searchParams.get("teste") === "1",
          }),
          label: `Voltar para ${game?.name ?? "o jogo"}`,
        }
      : backLink;

  return <BackButton backLink={destination} />;
}

function BackButton({ backLink }: { backLink: BackLink }) {
  const { requestBack } = usePageBack();

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="hidden shrink-0 md:inline-flex"
    >
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
          ) {
            event.preventDefault();
          }
        }}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Link>
    </Button>
  );
}