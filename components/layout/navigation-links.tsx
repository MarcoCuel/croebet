"use client";

import { GameControllerIcon } from "@phosphor-icons/react/dist/csr/GameController";
import { HouseIcon } from "@phosphor-icons/react/dist/csr/House";
import { InfoIcon } from "@phosphor-icons/react/dist/csr/Info";
import { TicketIcon } from "@phosphor-icons/react/dist/csr/Ticket";
import { TrophyIcon } from "@phosphor-icons/react/dist/csr/Trophy";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Início", Icon: HouseIcon },
  { href: "/jogos", label: "Jogos", Icon: GameControllerIcon },
  { href: "/apostas", label: "Apostas", Icon: TicketIcon },
  { href: "/rankings", label: "Rankings", Icon: TrophyIcon },
  { href: "/sobre", label: "Sobre", Icon: InfoIcon },
];

export function MenuLinks({
  onNavigate,
  sidebar = false,
}: {
  onNavigate?: () => void;
  sidebar?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1.5" aria-label="Navegação principal">
      {links.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-label={label}
          title={label}
          className={cn(
            "flex min-h-10 items-center gap-3 rounded-panel border-(length:--border-width-hairline) border-transparent px-3 text-left text-sm text-muted outline-none hover:bg-control-hover hover:text-foreground focus-visible:border-foreground aria-[current]:bg-control aria-[current]:text-foreground",
            sidebar &&
              "@max-[8rem]/sidebar:justify-center @max-[8rem]/sidebar:px-0 @min-[8rem]/sidebar:relative @min-[8rem]/sidebar:pl-7 @min-[8rem]/sidebar:aria-[current]:before:absolute @min-[8rem]/sidebar:aria-[current]:before:left-3 @min-[8rem]/sidebar:aria-[current]:before:size-1.5 @min-[8rem]/sidebar:aria-[current]:before:rounded-full @min-[8rem]/sidebar:aria-[current]:before:bg-brand",
          )}
          aria-current={
            pathname === href
              ? "page"
              : pathname.startsWith(href + "/")
                ? "location"
                : undefined
          }
          onClick={onNavigate}
        >
          <Icon
            className={cn(
              "size-5 shrink-0",
              sidebar && "@min-[8rem]/sidebar:hidden",
            )}
            aria-hidden="true"
          />
          <span className={cn(sidebar && "@max-[8rem]/sidebar:hidden")}>
            {label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
