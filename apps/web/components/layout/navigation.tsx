"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChatProvider } from "@/features/chat/chat-context";
import { ChatSidebar } from "@/features/chat/general-chat";
import { useSession } from "@/features/auth/session-context";
import { useLobbyInvitations } from "@/features/games/lobby-invitations";
import { Balance } from "@/features/wallet/balance";
import { RedeemButton } from "@/features/wallet/redeem-button";
import { DailyBonusButton } from "@/features/wallet/daily-bonus-button";
import { Button } from "@/components/ui/button";
import { NotificationsMenu } from "./notifications-menu";
import { useNotificationTitle } from "./use-notification-title";
import { Sidebar } from "./sidebar";
import { PageBackProvider } from "./page-back";
import { MatchNavbarProvider } from "./match-navbar";
import { Topbar } from "./topbar";
import { MenuLinks } from "./navigation-links";
import { AppInstall } from "./app-install";
import { Footer, FooterLinks } from "./footer";
import { cn } from "@/lib/utils";
import { brandLinkClass, Wordmark } from "./brand";

export function Navigation({ children }: { children: ReactNode }) {
  return <ChatProvider><NavigationLayout>{children}</NavigationLayout></ChatProvider>;
}

function NavigationLayout({ children }: { children: ReactNode }) {
  const { username, balance, walletReady } = useSession();
  const invitations = useLobbyInvitations();
  useNotificationTitle(invitations.length);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const matchCode = searchParams.get("partida");
  const sidebarScope = pathname.startsWith("/jogos/") && matchCode
    ? `${pathname}?partida=${matchCode}`
    : null;
  const defaultSidebar = sidebarScope ? "collapsed" : "expanded";
  const [sidebarState, setSidebarState] = useState<{
    scope: string | null;
    value: "expanded" | "collapsed";
  }>({ scope: sidebarScope, value: defaultSidebar });
  const sidebar = sidebarState.scope === sidebarScope ? sidebarState.value : defaultSidebar;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuTrigger = useRef<HTMLElement | null>(null);

  // Apply the destination's default before rendering children, including direct entry
  // and browser back/forward. Manual toggles last while staying in this scope.
  if (sidebarState.scope !== sidebarScope) {
    setSidebarState({ scope: sidebarScope, value: defaultSidebar });
  }

  useEffect(() => {
    // Route changes dismiss navigation overlays, including browser back/forward.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 48rem)");
    const closeMenu = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileMenuOpen(false);
    };
    desktop.addEventListener("change", closeMenu);
    return () => desktop.removeEventListener("change", closeMenu);
  }, []);

  function toggleSidebar() {
    setSidebarState({
      scope: sidebarScope,
      value: sidebar === "expanded" ? "collapsed" : "expanded",
    });
  }

  return (
    <PageBackProvider>
      <MatchNavbarProvider active={!!sidebarScope}>
      <div
        className="group/navigation [--sidebar-width:0rem] md:data-[sidebar=expanded]:[--sidebar-width:var(--sidebar-expanded)]"
        data-sidebar={sidebar}
      >
        <a
          href="#page-content"
          className="sr-only z-50 rounded-lg bg-surface p-3 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Pular para o conteúdo
        </a>
        <Sidebar expanded={sidebar === "expanded"} onToggle={toggleSidebar} />
        <Topbar
          invitations={invitations}
          mobileMenuOpen={mobileMenuOpen}
          onOpenMenu={() => {
            menuTrigger.current =
              document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
            setMobileMenuOpen(true);
          }}
        />
        <Dialog open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <DialogContent
            variant="drawer"
            showCloseButton={false}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              menuTrigger.current?.focus();
            }}
          >
            <DialogTitle className="sr-only">Menu da Croebet</DialogTitle>
            <DialogDescription className="sr-only">
              Navegue pelas seções da Croebet.
            </DialogDescription>
            <div className="flex min-h-full flex-col gap-5">
              <div className="flex min-h-11 items-center justify-between gap-2">
                <Link
                  className={brandLinkClass}
                  href="/"
                  aria-label="Croebet, início"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Wordmark />
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {username && <NotificationsMenu invitations={invitations} />}
                  <DialogClose asChild>
                    <Button variant="secondary" size="icon-sm" aria-label="Fechar">
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </DialogClose>
                </div>
              </div>
              <MenuLinks onNavigate={() => setMobileMenuOpen(false)} />
              <div className="mt-auto space-y-3 pb-[env(safe-area-inset-bottom)]">
                {username && (
                  <div className="space-y-3 border-t border-contrast/6 pt-4" aria-label="Atalhos da conta">
                    <div className="flex flex-wrap items-center gap-2">
                      <DailyBonusButton />
                    </div>
                  </div>
                )}
                <AppInstall />
                {username && (
                  <div className="flex min-w-0 items-center gap-2 rounded-panel bg-contrast/6 p-1.5">
                    <Button asChild variant="ghost" className="min-w-0 flex-1 justify-start overflow-hidden px-2 font-normal text-foreground">
                      <Link href="/carteira" aria-label="Ver carteira" onClick={() => setMobileMenuOpen(false)}>
                        <Balance key={username} value={walletReady ? balance : null} showCurrency />
                      </Link>
                    </Button>
                    <RedeemButton />
                  </div>
                )}
                <FooterLinks onNavigate={() => setMobileMenuOpen(false)} className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted" />
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <ChatSidebar />
        <div
          className={cn("flex min-h-dvh min-w-0 flex-col pl-(--sidebar-width) pt-(--header-height) transition-[padding-left] duration-300 ease-in-out motion-reduce:transition-none", sidebarScope && "h-dvh overflow-hidden")}
          id="page-content"
          tabIndex={-1}
        >
          <div className={sidebarScope ? "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain" : "contents"} data-lenis-prevent={sidebarScope ? "" : undefined} data-match-content={sidebarScope ? "" : undefined}>
            {children}
          </div>
          {!sidebarScope && <Footer />}
        </div>
      </div>
    </MatchNavbarProvider>
    </PageBackProvider>
  );
}
