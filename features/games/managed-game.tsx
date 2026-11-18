"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSiteConfig } from "@/features/admin/site-config";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ManagedGame({
  slug,
  children,
}: {
  slug: string;
  children: ReactNode;
}) {
  const { config, ready } = useSiteConfig();
  const game = config.games.find((game) => game.slug === slug);
  if (!ready)
    return (
      <p role="status" className="text-muted">
        Carregando jogo…
      </p>
    );
  if (!game?.enabled)
    return (
      <Card className="grid justify-items-start gap-4">
        <h1 className="text-xl font-semibold">Jogo indisponível</h1>
        <Button asChild variant="secondary">
          <Link href="/jogos">Ver jogos</Link>
        </Button>
      </Card>
    );
  return (
    <>
      <h1 className="sr-only">{game.name}</h1>
      {children}
    </>
  );
}
