"use client";

import Link from "next/link";
import { Icon } from "lucide-react";

import { useMenus } from "@/features/menus/menu-provider";

export function Footer() {
  return (
    <footer className="flex flex-col gap-4 p-2 text-xs text-muted">
      <FooterLinks className="flex flex-wrap items-center gap-4" />
      <p>Croebet · 2026</p>
    </footer>
  );
}

export function FooterLinks({ onNavigate, className = "flex flex-wrap gap-4" }: { onNavigate?: () => void; className?: string }) {
  const menus = useMenus();
  return (
      <nav className={className} aria-label="Navegação do rodapé">
        {(menus?.footer ?? []).map(item => item.disabled
          ? <span key={item.id} className="inline-flex items-center gap-2" aria-disabled="true">{item.iconNode && <Icon iconNode={item.iconNode} className="size-4 shrink-0" aria-hidden="true" data-icon={item.icon} />}{item.label} · Em breve</span>
          : <Link key={item.id} className="inline-flex items-center gap-2 hover:text-foreground" href={item.href} target={item.newTab ? "_blank" : undefined} rel={item.newTab ? "noopener noreferrer" : undefined} onClick={onNavigate}>{item.iconNode && <Icon iconNode={item.iconNode} className="size-4 shrink-0" aria-hidden="true" data-icon={item.icon} />}{item.label}</Link>)}
      </nav>
  );
}
