import Link from "next/link";
import { Card } from "@/components/ui/card";
import { markets, formatOdds } from "./markets";

export function MarketPreviews() {
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {markets.map(({ id, question, topic, options }) => (
        <li key={id}>
          <Card
            asChild
            className="flex h-full flex-col p-4 hover:bg-control sm:p-5"
          >
            <Link href={`/apostas#${id}`}>
              <span className="text-xs font-semibold text-accent">{topic}</span>
              <span className="mt-1.5 mb-4 text-base font-semibold text-foreground">
                {question}
              </span>
              <span className="mt-auto grid grid-cols-2 gap-1.5">
                {options.map(({ outcome, odds }) => (
                  <span
                    className="flex min-h-9 flex-wrap items-center justify-between gap-x-1 rounded-lg bg-background px-2 py-1 text-xs text-muted"
                    key={outcome}
                  >
                    {outcome}{" "}
                    <span className="font-semibold text-foreground">
                      {formatOdds.format(odds / 100)}×
                    </span>
                  </span>
                ))}
              </span>
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}
