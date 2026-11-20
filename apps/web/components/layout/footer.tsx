"use client";

import Link from "next/link";
import { Icon } from "lucide-react";

import { useMenus } from "@/features/menus/menu-provider";

export function Footer() {
  const menus = useMenus();
  return (
    <footer className="mx-auto mt-12 flex w-[calc(100%-2*var(--page-gap))] flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t-(length:--border-width-hairline) border-contrast/6 py-6 px-2 text-sm text-muted">
      <nav className="flex flex-wrap gap-4" aria-label="Navegação do rodapé">
        {(menus?.footer ?? []).map(item => item.disabled
          ? <span key={item.id} className="inline-flex items-center gap-2" aria-disabled="true">{item.iconNode && <Icon iconNode={item.iconNode} className="size-4 shrink-0" aria-hidden="true" data-icon={item.icon} />}{item.label} · Em breve</span>
          : <Link key={item.id} className="inline-flex items-center gap-2 hover:text-foreground" href={item.href} target={item.newTab ? "_blank" : undefined} rel={item.newTab ? "noopener noreferrer" : undefined}>{item.iconNode && <Icon iconNode={item.iconNode} className="size-4 shrink-0" aria-hidden="true" data-icon={item.icon} />}{item.label}</Link>)}
      </nav>
      <p>Croebet · 2026</p>
    </footer>
  );
}
