"use client";

import { BellIcon } from "@phosphor-icons/react/dist/csr/Bell";
import { GiftIcon } from "@phosphor-icons/react/dist/csr/Gift";
import { ListIcon } from "@phosphor-icons/react/dist/csr/List";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemoSession } from "@/features/auth/session-context";
import { AccountMenu } from "@/features/auth/account-menu";
import { Balance } from "@/features/wallet/balance";
import { RedeemButton } from "@/features/wallet/redeem-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { brandLinkClass, Wordmark } from "./brand";
import { cn } from "@/lib/utils";

export function Topbar({
  mobileMenuOpen,
  onOpenMenu,
  onOpenBalance,
}: {
  mobileMenuOpen: boolean;
  onOpenMenu: () => void;
  onOpenBalance: () => void;
}) {
  const isBets = usePathname() === "/apostas";
  const {
    username,
    balance,
    claimDaily,
    dailyClaimed,
    openLogin,
    openRegister,
  } = useDemoSession();
  return (
    <header className="fixed top-0 right-0 left-(--sidebar-width) z-20 flex h-(--header-height) items-center justify-between gap-2 bg-chrome px-(--page-gap) md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Button
          variant="secondary"
          size="icon"
          className="size-10 md:hidden"
          aria-label="Abrir menu"
          aria-haspopup="dialog"
          aria-expanded={mobileMenuOpen}
          onClick={onOpenMenu}
        >
          <ListIcon className="size-5" aria-hidden="true" />
        </Button>
        <Link
          className={cn(brandLinkClass, "text-xl md:hidden")}
          href="/"
          aria-label="Croebet, início"
        >
          <Wordmark />
        </Link>
        <nav
          className="hidden items-center gap-1 rounded-panel bg-control p-1.5 md:flex"
          aria-label="Seções da Croebet"
        >
          <Button
            asChild
            variant={isBets ? "ghost" : "default"}
            size="sm"
            className={cn("text-sm", isBets && "font-normal")}
          >
            <Link aria-current={isBets ? undefined : "location"} href="/">
              Cassino
            </Link>
          </Button>
          <Button
            asChild
            variant={isBets ? "default" : "ghost"}
            size="sm"
            className={cn("text-sm", !isBets && "font-normal")}
          >
            <Link aria-current={isBets ? "page" : undefined} href="/apostas">
              Apostas
            </Link>
          </Button>
        </nav>
      </div>
      {username ? (
        <>
          <div className="hidden items-center gap-2 rounded-panel bg-control p-1.5 md:flex">
            <Button
              variant="ghost"
              className="min-h-0 min-w-0 shrink px-0.5 py-0 font-normal text-foreground"
              aria-haspopup="dialog"
              onClick={onOpenBalance}
            >
              <Balance value={balance} />
            </Button>
            <RedeemButton />
          </div>
          <div className="flex min-w-0 items-center justify-self-end gap-1.5 sm:gap-2">
            <Button
              variant="secondary"
              className="min-w-0 shrink px-2 font-normal md:hidden"
              aria-haspopup="dialog"
              onClick={onOpenBalance}
            >
              <Balance value={balance} />
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="hidden bg-linear-to-t from-brand/30 to-background md:inline-flex"
                  aria-label="Resgatar bônus diário"
                  onClick={claimDaily}
                  disabled={dailyClaimed}
                >
                  <GiftIcon className="size-5" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {dailyClaimed
                  ? "Bônus diário resgatado"
                  : "Resgatar bônus diário"}
              </TooltipContent>
            </Tooltip>
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    aria-label="Notificações"
                  >
                    <BellIcon className="size-5" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 p-2">
                  <DropdownMenuLabel>
                    Nenhuma notificação por enquanto.
                  </DropdownMenuLabel>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <AccountMenu name={username} onOpenBalance={onOpenBalance} />
          </div>
        </>
      ) : (
        <div className="col-start-3 flex shrink-0 justify-self-end gap-1.5 sm:gap-2">
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
