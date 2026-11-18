import { PageShell } from "@/components/layout/page-shell";
import { Heading } from "@/components/shared/heading";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Rankings · Croebet" };

const rankings = [
  {
    title: "Maiores ganhadores",
    label: "Croins ganhos",
    players: [
      { name: "SorteDePrincipiante", amount: 128450 },
      { name: "DamaDeCopas", amount: 96720 },
      { name: "PixImaginario", amount: 84310 },
      { name: "GatoDaSorte", amount: 71850 },
      { name: "Palpiteiro", amount: 65400 },
      { name: "LuaVirada", amount: 58960 },
      { name: "SoMaisUma", amount: 47230 },
      { name: "CoringaDoChat", amount: 39800 },
      { name: "QuaseRico", amount: 32450 },
      { name: "UltimaFicha", amount: 28710 },
    ],
  },
  {
    title: "Maiores perdedores",
    label: "Croins perdidos",
    players: [
      { name: "AgoraVai", amount: 156800 },
      { name: "AllInNoAzar", amount: 119350 },
      { name: "ConfiaNoPalpite", amount: 98740 },
      { name: "PatrocinadorDaCasa", amount: 87320 },
      { name: "SemSaldo", amount: 76450 },
      { name: "FoiPorPouco", amount: 63890 },
      { name: "TarotNaoAvisou", amount: 55120 },
      { name: "VoltoAmanha", amount: 48670 },
      { name: "DeuRuim", amount: 39400 },
      { name: "ApostaDuvidosa", amount: 31250 },
    ],
  },
];

const formatCroins = new Intl.NumberFormat("pt-BR");

export default function Rankings() {
  return (
    <PageShell>
      <h1 className="sr-only">Rankings</h1>
      <div className="grid gap-3 lg:grid-cols-2">
        {rankings.map(({ title, label, players }, index) => (
          <Card asChild key={title}>
            <section aria-labelledby={`ranking-${index}`}>
              <Heading id={`ranking-${index}`}>{title}</Heading>
              <ol
                role="list"
                className="mx-auto mt-8 grid max-w-sm grid-cols-3 items-end gap-2 pb-8 pt-4"
              >
                {players.slice(0, 3).map(({ name, amount }, position) => (
                  <li
                    key={name}
                    value={position + 1}
                    className={cn(
                      "flex min-w-0 flex-col items-center text-center",
                      position === 0
                        ? "order-2 pb-5"
                        : position === 1
                          ? "order-1"
                          : "order-3",
                    )}
                  >
                    <div className="relative">
                      <Avatar
                        className={cn(
                          "border-2 border-brand p-1",
                          position === 0 ? "size-20" : "size-16",
                        )}
                        aria-hidden="true"
                      >
                        <AvatarFallback className="rounded-full text-lg">
                          {name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -top-3 left-1/2 grid size-6 -translate-x-1/2 place-items-center rounded-full bg-brand text-xs font-semibold text-white">
                        <span className="sr-only">Posição </span>
                        {position + 1}
                      </span>
                    </div>
                    <span
                      className="mt-3 w-full truncate text-sm font-semibold"
                      title={name}
                    >
                      {name}
                    </span>
                    <span className="mt-1 text-xs text-muted tabular-nums">
                      {formatCroins.format(amount)} Croins
                      <span className="sr-only"> {label}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <ol
                role="list"
                start={4}
                className="divide-y divide-contrast/6 border-t border-contrast/6"
              >
                {players.slice(3).map(({ name, amount }, position) => (
                  <li
                    key={name}
                    className="flex items-center gap-3 py-4 last:pb-0"
                  >
                    <span
                      className="w-5 shrink-0 text-center text-sm font-semibold text-muted tabular-nums"
                      aria-hidden="true"
                    >
                      {position + 4}
                    </span>
                    <span
                      className="grid size-10 shrink-0 place-items-center rounded-full bg-contrast/6 text-xs font-semibold text-muted inset-shadow-primary-button"
                      aria-hidden="true"
                    >
                      {name.slice(0, 2).toUpperCase()}
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-sm font-medium"
                      title={name}
                    >
                      {name}
                    </span>
                    <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
                      {formatCroins.format(amount)}
                      <span className="ml-1 text-xs font-normal text-muted">
                        Croins
                      </span>
                      <span className="sr-only"> {label}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
