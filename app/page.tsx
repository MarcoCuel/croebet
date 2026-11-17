import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import { TicketIcon } from "@phosphor-icons/react/dist/ssr/Ticket";
import Link from "next/link";
import { GameGrid } from "@/features/games/game-grid";
import { HomeBanners } from "@/features/home/home-banners";
import { MarketPreviews } from "@/features/betting/market-previews";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/shared/heading";
import { PageShell } from "@/components/layout/page-shell";

export default function Home() {
  return (
    <PageShell inner={false}>
      <HomeBanners />
      <section className="mt-8" aria-labelledby="games-title">
        <h2
          className="mb-4 text-2xl font-medium tracking-tight"
          id="games-title"
        >
          Jogos
        </h2>
        <GameGrid />
      </section>
      <section className="mt-8" aria-labelledby="bets-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Heading className="flex items-center gap-2.5" id="bets-title">
            <TicketIcon
              className="size-5 text-accent"
              weight="fill"
              aria-hidden="true"
            />
            Apostas em destaque
          </Heading>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="min-h-9 gap-1.5 rounded-lg px-2 text-sm"
          >
            <Link href="/apostas">
              Ver apostas
              <ArrowRightIcon className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <p className="mb-3 text-sm text-muted">
          Palpites de demonstração em Croins.
        </p>
        <MarketPreviews />
      </section>
    </PageShell>
  );
}
