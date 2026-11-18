"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentProps } from "react";
import { useDemoSession } from "@/features/auth/session-context";
import { dailyReward } from "@/features/wallet/wallet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heading } from "@/components/shared/heading";
import { cn } from "@/lib/utils";
import { CroinBanner } from "@/three/scenes/croin-banner";

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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!dailyClaimed) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [dailyClaimed]);

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(now)).split(":").map(Number);
  const seconds = 86400 - (time[0] * 3600 + time[1] * 60 + time[2]);
  const countdown = [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ].map((value) => String(value).padStart(2, "0")).join(":");
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
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/jogos">Ver jogos</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/apostas">Ver apostas</Link>
            </Button>
          </div>
        ) : (
          <Button aria-haspopup="dialog" onClick={openRegister}>
            Criar conta
          </Button>
        )}
      </Banner>
      <Banner className="bg-linear-to-b from-reward-start to-reward-end">
        <CroinBanner />
        <Badge className="tabular-nums">
          {dailyClaimed ? `Próximo resgate em ${countdown}` : "Disponível"}
        </Badge>
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
      <Banner className="bg-surface text-foreground">
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
