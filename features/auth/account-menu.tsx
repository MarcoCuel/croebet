"use client";

import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CoinsIcon } from "@phosphor-icons/react/dist/csr/Coins";
import { GearIcon } from "@phosphor-icons/react/dist/csr/Gear";
import { MoonIcon } from "@phosphor-icons/react/dist/csr/Moon";
import { SignOutIcon } from "@phosphor-icons/react/dist/csr/SignOut";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRef } from "react";
import { useDemoSession } from "./session-context";
import { cn } from "@/lib/utils";

export function AccountMenu({
  name,
  sidebar = false,
  onOpenBalance,
}: {
  name: string;
  sidebar?: boolean;
  onOpenBalance: () => void;
}) {
  const { signOut } = useDemoSession();
  const trigger = useRef<HTMLButtonElement>(null);
  const openingBalance = useRef(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={trigger}
          variant="secondary"
          className={cn(
            "h-11 px-2 py-0 font-normal",
            sidebar ? "w-full justify-start" : "w-auto",
          )}
          aria-label={"Conta de " + name}
        >
          <Avatar aria-hidden="true">
            <AvatarFallback>
              {Array.from(name)[0]?.toLocaleUpperCase("pt-BR")}
            </AvatarFallback>
          </Avatar>
          <span
            className={
              sidebar
                ? "min-w-0 flex-1 truncate text-left"
                : "hidden max-w-24 truncate sm:inline"
            }
          >
            {name}
          </span>
          <CaretDownIcon
            className="hidden size-4 text-muted sm:inline"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={sidebar ? "top" : "bottom"}
        align={sidebar ? "start" : "end"}
        className="[&_[data-slot=dropdown-menu-item]]:gap-2 [&_[data-slot=dropdown-menu-item]]:text-xs"
        onCloseAutoFocus={(event) => {
          if (openingBalance.current) {
            event.preventDefault();
            openingBalance.current = false;
          }
        }}
      >
        <DropdownMenuItem
          onSelect={() => toast.info("Configurações ainda não disponíveis.")}
        >
          <GearIcon className="size-4" aria-hidden="true" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => toast.info("O tema escuro é o único disponível por enquanto.")}
        >
          <MoonIcon className="size-4" aria-hidden="true" />
          Tema
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            openingBalance.current = true;
            trigger.current?.focus();
            onOpenBalance();
          }}
        >
          <CoinsIcon className="size-4" aria-hidden="true" />
          Saldo
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <SignOutIcon className="size-4" aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
