"use client";

import {
  ChevronDown,
  History,
  Shield,
  Settings,
  Moon,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useRef, useState } from "react";
import { SettingsDialog } from "@/features/settings/settings-dialog";
import { useDemoSession } from "./session-context";
import { cn } from "@/lib/utils";
import { useTheme } from "@/features/theme/theme-provider";

export function AccountMenu({
  name,
  sidebar = false,
}: {
  name: string;
  sidebar?: boolean;
}) {
  const { signOut, avatar, permissions } = useDemoSession();
  const { theme, setTheme } = useTheme();
  const trigger = useRef<HTMLButtonElement>(null);
  const openingDialog = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <>
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
              {avatar && <AvatarImage src={avatar} alt="" />}
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
          onCloseAutoFocus={(event) => {
            if (openingDialog.current) {
              event.preventDefault();
              openingDialog.current = false;
            }
          }}
        >
          <DropdownMenuItem
            onSelect={() => {
              openingDialog.current = true;
              trigger.current?.focus();
              setSettingsOpen(true);
            }}
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
                  if (
                    value === "light" ||
                    value === "dark" ||
                    value === "system"
                  )
                    setTheme(value);
                }}
              >
                <DropdownMenuRadioItem value="light">
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          {permissions.canManageSite && (
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <Shield className="size-4" aria-hidden="true" />
                Admin
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href="/historico">
              <History className="size-4" aria-hidden="true" />
              Histórico
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={signOut}>
            <LogOut className="size-4" aria-hidden="true" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          trigger.current?.focus();
        }}
      />
    </>
  );
}
