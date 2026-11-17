import Link from "next/link";

export function Footer() {
  return (
    <footer className="mx-auto mt-11 flex w-[calc(100%-2*var(--page-gap))] flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t-(length:--border-width-hairline) border-border pt-4 pb-7 text-sm text-muted">
      <p>Croebet é uma paródia. Todo saldo é fictício.</p>
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
    </footer>
  );
}
