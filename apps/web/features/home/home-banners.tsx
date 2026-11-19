"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentProps } from "react";
import { useSession } from "@/features/auth/session-context";
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
  const { username, openRegister, economy, daily, claimDaily, claimingDaily, refreshWallet } = useSession();
  const [clock, setClock] = useState({ snapshot: daily?.serverNow, elapsed: 0 });
  const elapsed = clock.snapshot === daily?.serverNow ? clock.elapsed : 0;
  useEffect(() => {
    if (!daily?.nextClaimAt) return;
    const started = Date.now();
    const timer = window.setInterval(() => setClock({ snapshot: daily.serverNow, elapsed: Date.now() - started }), 1000);
    return () => window.clearInterval(timer);
  }, [daily]);
  const seconds = daily?.nextClaimAt ? Math.max(0, Math.ceil((Date.parse(daily.nextClaimAt) - Date.parse(daily.serverNow) - elapsed) / 1000)) : 0;
  const coolingDown = seconds > 0;
  const countdown = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map(value => String(value).padStart(2, "0")).join(":");
  return (
    <section
      className="grid gap-3 sm:grid-cols-2"
      aria-label="Destaques da Croebet"
    >
      <Banner className="bg-brand">
        <Heading asChild variant="banner">
          <h1>
            Jogue na
            <br />
            Croebet
          </h1>
        </Heading>
        {username ? (
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/jogos">Ver jogos</Link>
            </Button>
          </div>
        ) : (
          <Button aria-haspopup="dialog" onClick={openRegister}>
            Criar conta
          </Button>
        )}
      </Banner>
      <Banner className="bg-linear-to-b from-reward-start to-reward-end text-foreground">
        <Badge className="tabular-nums">
          {!username ? "Entre para resgatar" : !daily ? "Indisponível" : coolingDown ? `Próximo resgate em ${countdown}` : "Disponível"}
        </Badge>
        <div>
          <Heading variant="banner">Bônus diário</Heading>
          <p className="mt-3 text-sm sm:text-base">
            Ganhe <strong>10 Croins</strong> grátis a cada 24 horas. <br/>Volte todos os dias para resgatar!
          </p>
          <Button className="mt-5" onClick={username && (!daily || !economy) ? refreshWallet : claimDaily} disabled={coolingDown} loading={claimingDaily}>
            {coolingDown ? "Aguarde o próximo resgate" : username && (!daily || !economy) ? "Tentar novamente" : "Resgatar 10 Croins"}
          </Button>
        </div>
      </Banner>
    </section>
  );
}
