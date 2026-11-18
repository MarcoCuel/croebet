"use client";

import { ArrowUpRight, Bell, Construction, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NotificationsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" aria-label="Notificações">
          <Bell className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        aria-label="Notificações"
        className="w-[26rem] max-h-[calc(100dvh-6rem)] overflow-y-auto p-1.5"
      >
        <DropdownMenuLabel className="flex items-start gap-4 px-3 py-3.5 font-normal whitespace-normal">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              Estamos em desenvolvimento
            </span>
            <span className="mt-1 block text-xs leading-snug text-muted">
              A Croebet está em construção. Ajustes e novidades podem aparecer enquanto você joga.
            </span>
            <span className="mt-3 block text-xs text-muted">18 de Nov. 2026</span>
          </span>
          <span className="flex h-17 w-24 shrink-0 items-center justify-center rounded-lg bg-control text-foreground" aria-hidden="true">
            <Construction className="size-8" />
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mx-4 my-1" />
        <DropdownMenuItem asChild className="items-start gap-4 rounded-xl border-0 px-3 py-3.5 whitespace-normal">
          <a href="https://www.youtube.com/@croezinha" target="_blank" rel="noopener noreferrer">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Croezinha no YouTube</span>
              <span className="mt-1 block text-xs leading-snug text-muted">
                Acompanhe as lives e os vídeos da Croezinha. A dona da casa também está por lá.
              </span>
              <span className="mt-3 flex items-center gap-1 text-xs text-brand">
                Acessar canal
                <ArrowUpRight className="size-3" aria-hidden="true" />
                <span className="sr-only"> (abre em nova aba)</span>
              </span>
            </span>
            <span className="flex h-17 w-24 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand" aria-hidden="true">
              <Play className="size-8" />
            </span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
