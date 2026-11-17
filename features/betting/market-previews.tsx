import Link from "next/link";
import { Card } from "@/components/ui/card";
import { markets } from "@/features/betting/markets";

export function MarketPreviews() {
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {markets.map((market) => (
        <li key={market.id}>
          <Card asChild className="flex h-full flex-col p-4 hover:bg-control sm:p-5">
            <Link href={`/apostas#${market.id}`}>
              <span className="text-xs text-muted">{market.topic}</span>
              <span className="mt-2 mb-5 text-base font-semibold">{market.question}</span>
              <span className="mt-auto text-sm text-accent">Dar um palpite</span>
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}
