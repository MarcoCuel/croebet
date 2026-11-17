"use client";

import Link from "next/link";
import { SidebarSimpleIcon } from "@phosphor-icons/react/dist/csr/SidebarSimple";
import { useDemoSession } from "@/features/auth/session-context";
import { AccountMenu } from "@/features/auth/account-menu";
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

export function Sidebar({
  onToggle,
  onOpenBalance,
}: {
  onToggle: () => void;
  onOpenBalance: () => void;
}) {
  const { username, balance } = useDemoSession();
  return (
    <aside
      id="lobby-sidebar"
      className="@container/sidebar fixed inset-y-0 left-0 z-30 hidden w-(--sidebar-width) flex-col border-r-(length:--border-width-hairline) border-border bg-chrome md:flex"
      aria-label="Menu lateral"
    >
      <div className="flex min-h-(--header-height) items-center justify-between gap-2 px-5 @max-[8rem]/sidebar:flex-col @max-[8rem]/sidebar:justify-center @max-[8rem]/sidebar:gap-1 @max-[8rem]/sidebar:py-2">
        <Link className={brandLinkClass} href="/" aria-label="Croebet, início">
          <Wordmark compact />
        </Link>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Alternar largura do menu lateral"
              aria-controls="lobby-sidebar"
              onClick={onToggle}
            >
              <SidebarSimpleIcon className="size-5" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            Alternar largura do menu lateral
          </TooltipContent>
        </Tooltip>
      </div>
      <div
        className="flex min-h-0 flex-1 flex-col justify-between gap-5 px-3 pb-3"
        data-lenis-prevent
      >
        <div className="min-h-0 overflow-y-auto">
          <MenuLinks sidebar />
        </div>
        {username && (
          <div className="@max-[8rem]/sidebar:hidden">
            <div className="mb-3 flex items-center justify-between gap-2 px-2">
              <Button
                variant="ghost"
                className="min-h-0 min-w-0 shrink p-0 font-normal text-foreground"
                aria-haspopup="dialog"
                onClick={onOpenBalance}
              >
                <Balance value={balance} />
              </Button>
              <RedeemButton />
            </div>
            <AccountMenu
              name={username}
              sidebar
              onOpenBalance={onOpenBalance}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
