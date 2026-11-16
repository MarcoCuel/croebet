import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "lenis/dist/lenis.css";
import "./globals.css";
import { Motion } from "./motion";
import { Navigation } from "./navigation";

export const metadata: Metadata = {
  title: "Croebet — Cassino de paródia",
  description: "Jogos de sorte, previsões duvidosas e dinheiro de mentira.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-background pt-(--header-space) font-sans text-base text-foreground">
        <Motion />
        <Navigation />
        {children}
        <footer className="shell mt-11 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t-(length:--border-width-hairline) border-border pt-4 pb-7 text-sm text-muted">
          <p>Croebet é uma paródia. Todo saldo é fictício.</p>
          <nav className="flex gap-4" aria-label="Navegação do rodapé">
            <Link className="hover:text-foreground" href="/jogos">Jogos</Link>
            <Link className="hover:text-foreground" href="/sobre">Sobre</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
