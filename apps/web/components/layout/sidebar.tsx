"use client";

import { PanelLeft } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/features/auth/session-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { brandLinkClass, Wordmark } from "./brand";
import { MenuLinks } from "./navigation-links";
import { AppInstall } from "./app-install";
import { Footer } from "./footer";

export function Sidebar({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const { sessionReady } = useSession();
  return (
    <>
      <aside
        id="lobby-sidebar"
        className="@container/sidebar fixed inset-y-0 left-0 z-30 hidden w-(--sidebar-expanded) flex-col bg-background transition-[translate,visibility] duration-300 ease-in-out motion-reduce:transition-none md:flex group-data-[sidebar=collapsed]/navigation:invisible group-data-[sidebar=collapsed]/navigation:-translate-x-full"
        inert={!expanded}
        aria-hidden={!expanded}
        aria-label="Menu lateral"
      >
        <div className="flex min-h-(--header-height) items-center justify-between gap-2 px-6 @max-[8rem]/sidebar:flex-col @max-[8rem]/sidebar:justify-center @max-[8rem]/sidebar:gap-1 @max-[8rem]/sidebar:py-2">
          <Link
            className={brandLinkClass}
            href="/"
            aria-label="Croebet, início"
          >
            <Wordmark compact />
          </Link>
        </div>
        <div
          className="flex min-h-0 flex-1 flex-col justify-between gap-4 px-4 pb-4"
          data-lenis-prevent
        >
          <div className="min-h-0 overflow-y-auto">
            <MenuLinks sidebar />
          </div>
          <div className="flex shrink-0 flex-col gap-3">
            <AppInstall />
            {!sessionReady ? (
              <div role="status" aria-label="Carregando conta" className="h-28 rounded-panel bg-contrast/6 motion-safe:animate-pulse" />
            ) : null}
            <Footer></Footer>
          </div>
        </div>
      </aside>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="fixed top-4.25 left-[max(1.25rem,calc(var(--sidebar-width)-3rem))] z-40 hidden transition-[left,background-color,color,border-color] duration-300 ease-in-out motion-reduce:transition-none md:inline-flex"
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
