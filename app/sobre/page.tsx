import { PageShell } from "@/components/layout/page-shell";
import { Heading } from "@/components/shared/heading";
import { Card } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sobre | Croebet",
  description:
    "Uma bet de mentira, com jogos de verdade e uma comunidade que levou a piada longe demais. Conheça a Croebet e sua moeda fictícia, a Croin.",
};

export default function About() {
  return (
    <PageShell>
      <div className="mx-auto max-w-[46rem]">
        <header data-enter>
          <Heading asChild variant="display">
            <h1>Uma piada que virou bet.</h1>
          </Heading>
          <p className="mt-4 max-w-[55ch] text-lg text-muted">
            Jogos de verdade, dinheiro de mentira e uma casa sem vergonha de
            querer todos os seus Croins. Essa é a Croebet.
          </p>
        </header>

        <section className="mt-10" aria-labelledby="origin-title" data-enter>
          <Heading id="origin-title">Como começou a piada</Heading>
          <p className="mt-3 leading-relaxed text-muted">
            A Croezinha é contra bets. A comunidade resolveu brincar que ela
            tinha uma. Entre uma live e outra, a piada cresceu, ela entrou na
            brincadeira e virou dona da própria casa de apostas. Faltava só
            alguém levar a ideia longe demais. E aqui estamos.
          </p>
          <p className="mt-3 leading-relaxed text-muted">
            A Croebet nasceu dessa zoeira: uma plataforma feita pela comunidade
            para jogar, dar palpites e rir dos próprios resultados. Quem chegou
            agora também pode participar. Não precisa conhecer as piadas
            internas para fazer uma aposta duvidosa.
          </p>
        </section>

        <Card asChild className="mt-7 p-5 sm:p-8">
          <section aria-labelledby="croins-title" data-enter>
            <Heading className="text-xl" id="croins-title">
              Seu dinheiro não nos interessa
            </Heading>
            <p className="mt-2 leading-relaxed text-muted">
              Aqui, tudo acontece com Croins, a moeda fictícia da Croebet.
              Elas não têm valor monetário: não há depósito de dinheiro real,
              compra de Croins ou saque em dinheiro. A casa quer o seu saldo,
              mas a sua conta bancária está fora dessa brincadeira.
            </p>
          </section>
        </Card>

        <section className="mt-10" aria-labelledby="house-title" data-enter>
          <Heading id="house-title">A casa torce contra. Faz parte.</Heading>
          <p className="mt-3 leading-relaxed text-muted">
            A Croebet faz o papel da bet gananciosa: comemora suas derrotas,
            lamenta suas vitórias e trata cada Croin perdido como uma bela
            contribuição. Se você ganhar, aproveite. Nosso departamento
            financeiro prefere não comentar.
          </p>
          <p className="mt-3 leading-relaxed text-muted">
            Essa falta de vergonha é personagem. As regras precisam ser claras
            e a brincadeira é com os palpites ruins, a sorte e a confiança
            exagerada. A ideia é rir junto, sem transformar ninguém em alvo.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="purpose-title" data-enter>
          <Heading id="purpose-title">A gente leva a piada a sério</Heading>
          <p className="mt-3 leading-relaxed text-muted">
            O projeto está em construção. Jogos, apostas em acontecimentos da
            comunidade, rankings de quem ganha e de quem perde: a ideia é dar
            mais motivos para a galera se encontrar, competir e ter história
            para contar no chat.
          </p>
          <p className="mt-3 leading-relaxed text-muted">
            Por trás da sátira, o ponto é simples: vício em apostas e prejuízo
            com dinheiro real não têm graça. Aqui, a disputa fica nos Croins.
            A Croebet leva os jogos a sério e os apostadores na brincadeira.
          </p>
        </section>
      </div>
    </PageShell>
  );
}
