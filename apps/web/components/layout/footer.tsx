"use client";

import Link from "next/link";

import { useSiteConfig } from "@/features/admin/site-config";

export function Footer() {
  const { config } = useSiteConfig();
  return (
    <footer className="mx-auto mt-12 flex w-[calc(100%-2*var(--page-gap))] flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t-(length:--border-width-hairline) border-contrast/6 py-6 px-2 text-sm text-muted">
      <nav className="flex flex-wrap gap-4" aria-label="Navegação do rodapé">
        <Link className="hover:text-foreground" href="/jogos">
          Jogos
        </Link>
        <Link className="hover:text-foreground" href="/apostas">
          Apostas
        </Link>
        {config.pages.filter((page) => page.published).map((page) => (
          <Link key={page.slug} className="hover:text-foreground" href={`/${page.slug}`}>{page.title}</Link>
        ))}
      </nav>
      <p>Croebet · 2026</p>
    </footer>
  );
}
