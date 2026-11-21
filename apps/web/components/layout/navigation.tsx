"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChatProvider, useGeneralChat } from "@/features/chat/chat-context";
import { ChatSidebar } from "@/features/chat/general-chat";
import { Sidebar } from "./sidebar";
import { PageBackProvider } from "./page-back";
import { Topbar } from "./topbar";
import { MenuLinks } from "./navigation-links";
import { AppInstall } from "./app-install";
import { brandLinkClass, Wordmark } from "./brand";

export function Navigation({ children }: { children: ReactNode }) {
  return <ChatProvider><NavigationLayout>{children}</NavigationLayout></ChatProvider>;
}

function NavigationLayout({ children }: { children: ReactNode }) {
  const chat = useGeneralChat();
  const pathname = usePathname();
  const [sidebar, setSidebar] = useState<"expanded" | "collapsed">("expanded");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuTrigger = useRef<HTMLElement | null>(null);

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
    setSidebar((current) =>
      current === "expanded" ? "collapsed" : "expanded",
    );
  }

  return (
    <PageBackProvider>
      <div
        className="group/navigation [--sidebar-width:0rem] [--chat-width:0rem] md:data-[sidebar=expanded]:[--sidebar-width:var(--sidebar-expanded)] md:data-[chat=open]:[--chat-width:20rem]"
        data-sidebar={sidebar}
        data-chat={chat?.open ? "open" : "closed"}
      >
        <a
          href="#page-content"
          className="sr-only z-50 rounded-lg bg-surface p-3 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Pular para o conteúdo
        </a>
        <Sidebar expanded={sidebar === "expanded"} onToggle={toggleSidebar} />
        <Topbar
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
              <Link
                className={brandLinkClass}
                href="/"
                aria-label="Croebet, início"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Wordmark />
              </Link>
              <MenuLinks onNavigate={() => setMobileMenuOpen(false)} />
              <div className="mt-auto"><AppInstall /></div>
            </div>
          </DialogContent>
        </Dialog>
        <ChatSidebar />
        <div
          className="flex min-h-dvh min-w-0 flex-col pl-(--sidebar-width) pr-(--chat-width) pt-(--header-height) transition-[padding-left,padding-right] duration-300 ease-in-out motion-reduce:transition-none"
          id="page-content"
          tabIndex={-1}
        >
          {children}
        </div>
      </div>
    </PageBackProvider>
  );
}
