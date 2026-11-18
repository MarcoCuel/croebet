import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "lenis/dist/lenis.css";
import "./globals.css";
import { Motion } from "@/components/layout/motion";
import { Navigation } from "@/components/layout/navigation";
import { Providers } from "@/components/layout/providers";
import { Footer } from "@/components/layout/footer";

const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  variable: "--font-inter",
  weight: "300 700",
  style: "normal",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Croebet — O meu também é Betty",
  description: "Jogos de sorte, previsões duvidosas e Croins em jogo.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(() => { let theme = 'system'; try { const saved = localStorage.getItem('croebet:theme'); if (saved === 'light' || saved === 'dark') theme = saved; } catch {} document.documentElement.dataset.themePreference = theme; document.documentElement.dataset.theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme; })();` }} />
      </head>
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
