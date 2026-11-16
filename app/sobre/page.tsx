import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr/ArrowUpRight";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sobre | Croebet",
  description: "Conheça a bet de mentira que os inscritos da Croezinha criaram para zoar as bets de verdade.",
};

export default function About() {
  return (
    <main className="shell inner">
      <div className="mx-auto max-w-[46rem]">
        <header data-enter>
          <h1 className="display-heading">Sobre o Croebet</h1>
          <p className="mt-4 max-w-[55ch] text-lg text-muted">
            Uma bet de mentira criada pelos inscritos da Croezinha pra zoar as bets de verdade.
          </p>
        </header>

        <section className="mt-10" aria-labelledby="origin-title" data-enter>
          <h2 className="section-heading" id="origin-title">Como começou a piada</h2>
          <p className="mt-3 leading-relaxed text-muted">
            A Croe é contra bets, e a galera do canal também. Daí veio a ideia de parodiar as propagandas de aposta fingindo que ela tinha fechado patrocínio com uma bet. Na nossa versão da história, ela é até dona da suposta patrocinadora.
          </p>
        </section>

        <section className="mt-7 rounded-panel bg-surface p-[clamp(1.25rem,3vw,2rem)]" aria-labelledby="croins-title" data-enter>
          <h2 className="text-xl font-bold" id="croins-title">Croins só valem aqui</h2>
          <p className="mt-2 leading-relaxed text-muted">
            Os jogos usam Croins, a moeda fictícia do Croebet. Não tem depósito, saque nem prêmio em dinheiro. Se você perder tudo na roleta, o máximo que pode sair daqui é uma história pro chat.
          </p>
        </section>

        <Link className="button button-lg mt-7" href="/jogos">
          Ver os jogos <ArrowUpRightIcon className="size-5" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
