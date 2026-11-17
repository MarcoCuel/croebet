import type { Metadata } from "next";
import type { ReactNode } from "react";
import "lenis/dist/lenis.css";
import "./globals.css";
import { Motion } from "@/components/layout/motion";
import { Navigation } from "@/components/layout/navigation";
import { Providers } from "@/components/layout/providers";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Croebet — O meu também é Bet",
  description: "Jogos de sorte, previsões duvidosas e dinheiro de mentira.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-background font-sans text-base text-foreground">
        <Motion />
        <Providers>
          <Navigation>
            {children}
            <Footer />
          </Navigation>
        </Providers>
      </body>
    </html>
  );
}
