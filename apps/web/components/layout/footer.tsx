"use client";

import Link from "next/link";

import { useMenus } from "@/features/menus/menu-provider";

export function Footer() {
  const menus = useMenus();
  return (
    <footer className="mx-auto mt-12 flex w-[calc(100%-2*var(--page-gap))] flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t-(length:--border-width-hairline) border-contrast/6 py-6 px-2 text-sm text-muted">
      <nav className="flex flex-wrap gap-4" aria-label="Navegação do rodapé">
        {(menus?.footer ?? []).map(item => item.disabled
          ? <span key={item.id} aria-disabled="true">{item.label} · Em breve</span>
          : <Link key={item.id} className="hover:text-foreground" href={item.href} target={item.newTab ? "_blank" : undefined} rel={item.newTab ? "noopener noreferrer" : undefined}>{item.label}</Link>)}
      </nav>
      {menus === null && <p role="status">Menu do rodapé temporariamente indisponível.</p>}
      <p>Croebet · 2026</p>
    </footer>
  );
}
