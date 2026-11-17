"use client";

import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CoinsIcon } from "@phosphor-icons/react/dist/csr/Coins";
import { SignOutIcon } from "@phosphor-icons/react/dist/csr/SignOut";
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
          className="h-11 w-full px-2 font-normal"
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
        align="end"
        onCloseAutoFocus={(event) => {
          if (openingBalance.current) {
            event.preventDefault();
            openingBalance.current = false;
          }
        }}
      >
        <DropdownMenuItem
          onSelect={() => {
            openingBalance.current = true;
            trigger.current?.focus();
            onOpenBalance();
          }}
        >
          <CoinsIcon className="size-4" aria-hidden="true" />
          Saldo de Croins
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <SignOutIcon className="size-4" aria-hidden="true" />
          Sair da conta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
