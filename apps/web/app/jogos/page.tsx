import { publicMetadata } from "@/features/seo/metadata";
import { PageShell } from "@/components/layout/page-shell";
import { GameGrid } from "@/features/games/game-grid";



export default function Games() {
  return (
    <PageShell>
      <h1 className="sr-only">Jogos</h1>
      <GameGrid />
    </PageShell>
  );
}

export async function generateMetadata() { return publicMetadata("/jogos", "Jogos"); }
