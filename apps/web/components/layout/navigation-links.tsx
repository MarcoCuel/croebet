"use client";

import { Icon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMenus } from "@/features/menus/menu-provider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function MenuLinks({
  onNavigate,
  sidebar = false,
}: {
  onNavigate?: () => void;
  sidebar?: boolean;
}) {
  const pathname = usePathname();
  const menus = useMenus();
  const menuLinks = menus?.main ?? [];
  return (
    <nav className="grid gap-1.5" aria-label="Navegação principal">
      {!menus && <p role="status" className="px-3 text-sm text-muted">Menu indisponível.</p>}
      {menuLinks.map(({ id, href, label, disabled, newTab, icon, iconNode }) => disabled ? (
        <span
          key={id}
          aria-disabled="true"
          title={`${label} — Em breve`}
          className={cn(
            "flex min-h-10 items-center gap-3 rounded-panel px-3 text-sm text-muted",
            sidebar && "@max-[8rem]/sidebar:justify-center @max-[8rem]/sidebar:px-0",
          )}
        >
          {iconNode && <Icon iconNode={iconNode} className="size-4 shrink-0" aria-hidden="true" data-icon={icon} />}
          <span className={cn(sidebar && "@max-[8rem]/sidebar:hidden")}>{label}</span>
          <Badge variant="secondary" className={cn("ml-auto shrink-0 whitespace-nowrap px-2 py-0.5 text-muted", sidebar && "@max-[8rem]/sidebar:hidden")}>Em breve</Badge>
        </span>
      ) : (
        <Link
          key={id}
          href={href}
          target={newTab ? "_blank" : undefined}
          rel={newTab ? "noopener noreferrer" : undefined}
          aria-label={label}
          title={label}
          className={cn(
            "flex min-h-10 items-center gap-3 rounded-panel border-(length:--border-width-hairline) border-transparent px-3 text-left text-sm text-muted outline-none hover:bg-contrast/10 hover:text-foreground focus-visible:border-foreground aria-[current]:bg-contrast/6 aria-[current]:text-foreground",
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
          {iconNode && <Icon iconNode={iconNode} className="size-4 shrink-0" aria-hidden="true" data-icon={icon} />}
          <span className={cn(sidebar && "@max-[8rem]/sidebar:hidden")}>
            {label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
