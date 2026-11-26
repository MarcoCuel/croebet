"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { gameIdSchema, type GameId } from "@croebet/shared";
import { cn } from "@/lib/utils";
import { PlayingCard } from "./flip7/playing-card";
import type { Card } from "./flip7/presentation";
import { LoveCard } from "./love-letter/love-card";
import { SoloCard } from "./solo/solo-card";
import styles from "./game-hero-cards.module.css";

// Each game supplies its existing card presentation; motion stays shared.
const flipCards: Card[] = [
  ...[2, 4, 6, 8, 10, 12].map(value => ({ id: value, type: "number" as const, value })),
  { id: 20, type: "freeze", value: 0 }, { id: 21, type: "chance", value: 0 },
  { id: 22, type: "three", value: 0 }, { id: 23, type: "bonus", value: 4 },
];
const cards: Record<GameId, readonly ReactNode[]> = {
  flip7: flipCards.map(card => <PlayingCard key={card.id} card={card} fluid />),
  "love-letter": Array.from({ length: 10 }, (_, value) => <LoveCard key={value} value={value} mode="modern" className="w-full sm:w-full" />),
  solo: Array.from({ length: 12 }, (_, index) => <span key={index} className="block [&>div]:w-full"><SoloCard card={{ id: `hero-${index}`, kind: "number", number: index % 9 + 1, color: (["red", "blue", "green", "yellow"] as const)[index % 4] }} /></span>),
};

// Both loop halves share the shuffle, but each visit gets a fresh seed.
function shuffled(deck: readonly ReactNode[], column: number, visitSeed: number) {
  const result = [...deck];
  let seed = visitSeed + column * 104729;
  for (let index = result.length - 1; index > 0; index--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const target = seed % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function GameHeroCards({ gameId }: { gameId: string }) {
  const [visitSeed, setVisitSeed] = useState<number | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisitSeed(crypto.getRandomValues(new Uint32Array(1))[0]));
    return () => cancelAnimationFrame(frame);
  }, [gameId]);
  const parsed = gameIdSchema.safeParse(gameId);
  if (!parsed.success || visitSeed === null) return null;
  const deck = cards[parsed.data];
  return <div aria-hidden="true" data-game-hero-cards={parsed.data} className="pointer-events-none absolute inset-y-0 right-0 w-3/5 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_45%)]">
    <div className="absolute top-1/2 right-8 flex h-[60rem] w-[26rem] -translate-y-1/2 rotate-[28deg] gap-4 sm:right-16">
      {[0, 1, 2].map(column => <div key={column} className="relative min-w-0 flex-1">
        <div data-hero-track={column} className={cn(styles.track, column === 1 && styles.reverse)} style={{ "--hero-duration": `${32 + column * 7}s`, "--hero-delay": `${-column * 9}s` } as CSSProperties}>
          {[0, 1].map(copy => <div key={copy} className="flex flex-col gap-4 pb-4">
            {shuffled(deck, column, visitSeed).map((card, index) => <div key={index} className="shrink-0">{card}</div>)}
          </div>)}
        </div>
      </div>)}
    </div>
  </div>;
}
