import Link from "next/link";

export function Footer() {
  return (
    <footer className="mx-auto mt-12 flex w-[calc(100%-2*var(--page-gap))] flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t-(length:--border-width-hairline) border-border py-6 px-2 text-sm text-muted">
      <nav className="flex flex-wrap gap-4" aria-label="Navegação do rodapé">
        <Link className="hover:text-foreground" href="/jogos">
          Jogos
        </Link>
        <Link className="hover:text-foreground" href="/apostas">
          Apostas
        </Link>
        <Link className="hover:text-foreground" href="/rankings">
          Rankings
        </Link>
        <Link className="hover:text-foreground" href="/sobre">
          Sobre
        </Link>
      </nav>
      <p>Croebet · 2026</p>
    </footer>
  );
}
