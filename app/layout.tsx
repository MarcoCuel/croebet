import type { Metadata } from "next";
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
        <footer className="shell mt-[42px] border-t border-border pt-[18px] pb-7 text-sm text-muted">Croebet é uma paródia. Todo saldo é fictício.</footer>
      </body>
    </html>
  );
}
