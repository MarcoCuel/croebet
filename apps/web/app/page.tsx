import { publicMetadata } from "@/features/seo/metadata";
import { GameGrid } from "@/features/games/game-grid";
import { HomeBanners } from "@/features/home/home-banners";
import { PageShell } from "@/components/layout/page-shell";

export default function Home() {
  return (
    <PageShell>
      <HomeBanners />
      <section className="mt-8" aria-labelledby="games-title">
        <h2 className="mb-4 text-2xl font-medium tracking-tight" id="games-title">
          Jogos
        </h2>
        <GameGrid />
      </section>
    </PageShell>
  );
}

export async function generateMetadata() { return publicMetadata("/"); }
