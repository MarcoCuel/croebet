import { GameGrid } from "@/features/games/game-grid";
import { HomeContent } from "@/features/home/home-section";
import { Predictions } from "@/features/betting/predictions";
import { HomeBanners } from "@/features/home/home-banners";
import { PageShell } from "@/components/layout/page-shell";

export default function Home() {
  return (
    <PageShell inner={false}>
      <HomeBanners />
      <HomeContent
        casino={
          <section className="mt-8" aria-labelledby="games-title">
            <h2
              className="mb-4 text-2xl font-medium tracking-tight"
              id="games-title"
            >
              Jogos
            </h2>
            <GameGrid />
          </section>
        }
        bets={
          <section className="mt-8" aria-labelledby="bets-title">
            <h2
              className="mb-4 text-2xl font-medium tracking-tight"
              id="bets-title"
            >
              Apostas
            </h2>
            <Predictions className="mt-0" />
          </section>
        }
      />
    </PageShell>
  );
}
