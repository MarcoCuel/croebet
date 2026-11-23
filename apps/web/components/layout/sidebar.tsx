"use client";

import { PanelLeft } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/features/auth/session-context";
import { AccountMenu } from "@/features/auth/account-menu";
import { SignupBanner } from "@/features/auth/signup-banner";
import { Balance } from "@/features/wallet/balance";
import { RedeemButton } from "@/features/wallet/redeem-button";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { brandLinkClass, Wordmark } from "./brand";
import { MenuLinks } from "./navigation-links";
import { AppInstall } from "./app-install";

export function Sidebar({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const { username, balance, walletReady, sessionReady } = useSession();
  return (
    <>
      <aside
        id="lobby-sidebar"
        className="@container/sidebar fixed inset-y-0 left-0 z-30 hidden w-(--sidebar-expanded) flex-col bg-background transition-[translate,visibility] duration-300 ease-in-out motion-reduce:transition-none md:flex group-data-[sidebar=collapsed]/navigation:invisible group-data-[sidebar=collapsed]/navigation:-translate-x-full"
        inert={!expanded}
        aria-hidden={!expanded}
        aria-label="Menu lateral"
      >
        <div className="flex min-h-(--header-height) items-center justify-between gap-2 px-5 @max-[8rem]/sidebar:flex-col @max-[8rem]/sidebar:justify-center @max-[8rem]/sidebar:gap-1 @max-[8rem]/sidebar:py-2">
          <Link
            className={brandLinkClass}
            href="/"
            aria-label="Croebet, início"
          >
            <Wordmark compact />
          </Link>
        </div>
        <div
          className="flex min-h-0 flex-1 flex-col justify-between gap-4 px-3 pb-3"
          data-lenis-prevent
        >
          <div className="min-h-0 overflow-y-auto">
            <MenuLinks sidebar />
          </div>
          <div className="flex shrink-0 flex-col gap-3">
            <AppInstall />
            {!sessionReady ? (
              <div role="status" aria-label="Carregando conta" className="h-28 rounded-panel bg-contrast/6 motion-safe:animate-pulse" />
            ) : username ? (
              <div className="-mx-3 @max-[8rem]/sidebar:hidden">
                <div className="mx-3 mb-3 flex items-center justify-between gap-2 rounded-panel bg-contrast/6 p-2">
                  <Button
                    asChild
                    variant="ghost"
                    className="min-h-0 min-w-0 shrink p-0 font-normal text-foreground"
                  >
                    <Link href="/carteira" aria-label="Ver carteira">
                      <Balance key={username} value={walletReady ? balance : null} showCurrency />
                    </Link>
                  </Button>
                  <RedeemButton />
                </div>
                <div className="px-3">
                  <AccountMenu name={username} sidebar />
                </div>
              </div>
            ) : (
              <SignupBanner />
            )}
          </div>
        </div>
      </aside>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="fixed top-[calc((var(--header-height)-2.25rem)/2)] left-[max(1.25rem,calc(var(--sidebar-width)-3.5rem))] z-40 hidden transition-[left,background-color,color,border-color] duration-300 ease-in-out motion-reduce:transition-none md:inline-flex"
            aria-label={
              expanded ? "Ocultar menu lateral" : "Mostrar menu lateral"
            }
            aria-expanded={expanded}
            aria-controls="lobby-sidebar"
            onClick={onToggle}
          >
            <PanelLeft className="size-4" aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {expanded ? "Ocultar menu lateral" : "Mostrar menu lateral"}
        </TooltipContent>
      </Tooltip>
    </>
  );
}
