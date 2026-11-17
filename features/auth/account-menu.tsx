"use client";

import { ChevronDown, History, Coins, Settings, Moon, LogOut } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { useRef } from "react";
import { useDemoSession } from "./session-context";
import { cn } from "@/lib/utils";
import { useTheme } from "@/features/theme/theme-provider";

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
  const { theme, setTheme } = useTheme();
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
            sidebar
              ? "w-full justify-start bg-transparent hover:bg-control"
              : "w-auto",
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
          <ChevronDown
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
          <Settings className="size-4" aria-hidden="true" />
          Configurações
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Moon className="size-4" aria-hidden="true" />
            Tema
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => {
                if (value === "light" || value === "dark" || value === "system")
                  setTheme(value);
              }}
            >
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem
          onSelect={() => {
            openingBalance.current = true;
            trigger.current?.focus();
            onOpenBalance();
          }}
        >
          <Coins className="size-4" aria-hidden="true" />
          Saldo
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/historico">
            <History className="size-4" aria-hidden="true" />
            Histórico
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <LogOut className="size-4" aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
