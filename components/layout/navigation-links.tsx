"use client";

import { Award, PlayingCards, House, Info, Tickets, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSiteConfig } from "@/features/admin/site-config";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Início", Icon: House },
  { href: "/jogos", label: "Jogos", Icon: PlayingCards },
  { href: "/apostas", label: "Apostas", Icon: Tickets },
  { href: "/rankings", label: "Rankings", Icon: Trophy },
  { href: "/conquistas", label: "Conquistas", Icon: Award },
];

export function MenuLinks({
  onNavigate,
  sidebar = false,
}: {
  onNavigate?: () => void;
  sidebar?: boolean;
}) {
  const pathname = usePathname();
  const { config } = useSiteConfig();
  const menuLinks = [...links, ...config.pages.filter((page) => page.published && page.showInMenu).map((page) => ({ href: `/${page.slug}`, label: page.title, Icon: Info }))];
  return (
    <nav className="grid gap-1.5" aria-label="Navegação principal">
      {menuLinks.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-label={label}
          title={label}
          className={cn(
            "flex min-h-10 items-center gap-3 rounded-panel border-(length:--border-width-hairline) border-transparent px-3 text-left text-sm text-muted outline-none hover:bg-control-hover hover:text-foreground focus-visible:border-foreground aria-[current]:bg-control aria-[current]:text-foreground",
            sidebar &&
              "@max-[8rem]/sidebar:justify-center @max-[8rem]/sidebar:px-0",
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
          <Icon className="size-4 shrink-0" aria-hidden="true" />
          <span className={cn(sidebar && "@max-[8rem]/sidebar:hidden")}>
            {label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
