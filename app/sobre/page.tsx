import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { Heading } from "@/components/shared/heading";
import { Card } from "@/components/ui/card";
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sobre | Croebet",
  description:
    "Conheça a bet de mentira que os inscritos da Croezinha criaram para zoar as bets de verdade.",
};

export default function About() {
  return (
    <PageShell>
      <div className="mx-auto max-w-[46rem]">
        <header data-enter>
          <Heading asChild variant="display">
            <h1>Sobre o Croebet</h1>
          </Heading>
          <p className="mt-4 max-w-[55ch] text-lg text-muted">
            Uma bet de mentira criada pelos inscritos da Croezinha pra zoar as
            bets de verdade.
          </p>
        </header>

        <section className="mt-10" aria-labelledby="origin-title" data-enter>
          <Heading id="origin-title">Como começou a piada</Heading>
          <p className="mt-3 leading-relaxed text-muted">
            A Croe é contra bets, e a galera do canal também. Daí veio a ideia
            de parodiar as propagandas de aposta fingindo que ela tinha fechado
            patrocínio com uma bet. Na nossa versão da história, ela é até dona
            da suposta patrocinadora.
          </p>
        </section>

        <Card asChild className="mt-7 p-5 sm:p-8">
          <section aria-labelledby="croins-title" data-enter>
            <Heading className="text-xl" id="croins-title">
              Croins só valem aqui
            </Heading>
            <p className="mt-2 leading-relaxed text-muted">
              Os jogos usam Croins, a moeda fictícia do Croebet. Não tem
              depósito, saque nem prêmio em dinheiro. Se você perder tudo na
              roleta, o máximo que pode sair daqui é uma história pro chat.
            </p>
          </section>
        </Card>

        <Button asChild className="mt-7">
          <Link href="/jogos">
            Ver os jogos{" "}
            <ArrowUpRightIcon className="size-5" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </PageShell>
  );
}
