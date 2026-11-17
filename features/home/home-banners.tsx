"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useDemoSession } from "@/features/auth/session-context";
import { dailyReward } from "@/features/wallet/wallet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heading } from "@/components/shared/heading";
import { cn } from "@/lib/utils";

function Banner({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "relative isolate flex min-h-52 flex-col items-start justify-between gap-6 overflow-hidden rounded-panel p-banner text-white @container sm:min-h-56 lg:min-h-banner-height",
        className,
      )}
      {...props}
    />
  );
}

export function HomeBanners() {
  const { username, openRegister, dailyClaimed, claimDaily } = useDemoSession();
  return (
    <section
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Destaques da Croebet"
    >
      <Banner className="bg-brand sm:col-span-2 lg:col-span-1">
        <Heading asChild variant="banner">
          <h1>
            Aposte na
            <br />
            Croebet
          </h1>
        </Heading>
        {username ? (
          <Button asChild>
            <Link href="/jogos">Ver jogos</Link>
          </Button>
        ) : (
          <Button aria-haspopup="dialog" onClick={openRegister}>
            Criar conta
          </Button>
        )}
      </Banner>
      <Banner className="bg-linear-to-b from-reward-start to-reward-end">
        <Badge role="status">{dailyClaimed ? "Resgatado" : "Disponível"}</Badge>
        <div>
          <Heading variant="banner">Resgate diário</Heading>
          <p className="mt-3 text-sm sm:text-base">
            {dailyReward} Croins por dia
          </p>
          <Button className="mt-5" onClick={claimDaily} disabled={dailyClaimed}>
            {dailyClaimed ? "Resgatado hoje" : "Resgatar"}
          </Button>
        </div>
      </Banner>
      <Banner className="bg-surface">
        <Heading variant="banner">
          Participe
          <br />
          do Ranking
        </Heading>
        <Button asChild>
          <Link href="/rankings">Ver ranking</Link>
        </Button>
      </Banner>
    </section>
  );
}
