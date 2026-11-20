import { publicMetadata } from "@/features/seo/metadata";
import { GameLinksProvider } from "@/features/games/game-links";
import { getPublicGames } from "@/features/games/server-games";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "lenis/dist/lenis.css";
import "./globals.css";
import { Motion } from "@/components/layout/motion";
import { Navigation } from "@/components/layout/navigation";
import { Providers } from "@/components/layout/providers";
import { getInitialSession } from "@/features/auth/server-session";
import { Footer } from "@/components/layout/footer";
import { loadPageLinks } from "@/features/pages/api";
import { loadNavigation } from "@/features/menus/api";

const inter = localFont({
  src: "./fonts/InterVariable.woff2",
  variable: "--font-inter",
  weight: "300 700",
  style: "normal",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export async function generateMetadata(): Promise<Metadata> {
  const metadata = await publicMetadata("/");
  return { ...metadata, alternates: undefined, robots: { index: false, follow: true }, icons: { icon: { url: "/favicon.png", type: "image/png", sizes: "512x512" } } };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const apiUrl = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001";
  const [initialSession, initialPages, initialNavigation, initialGames] = await Promise.all([getInitialSession(), loadPageLinks(apiUrl), loadNavigation(apiUrl), getPublicGames()]);
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(() => { let theme = 'system'; try { const saved = localStorage.getItem('croebet:theme'); if (saved === 'light' || saved === 'dark') theme = saved; } catch {} document.documentElement.dataset.themePreference = theme; document.documentElement.dataset.theme = theme === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme; })();` }} />
      </head>
      <body className="bg-background font-sans text-base text-foreground">
        <Motion />
        <Providers initialSession={initialSession} initialPages={initialPages} initialNavigation={initialNavigation}>
          <GameLinksProvider games={initialGames?.items ?? []}>
            <Navigation>
              {children}
              <Footer />
            </Navigation>
          </GameLinksProvider>
        </Providers>
      </body>
    </html>
  );
}
