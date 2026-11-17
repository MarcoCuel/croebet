import { PageShell } from "@/components/layout/page-shell";
import { Heading } from "@/components/shared/heading";
import { Card } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sobre | Croebet",
  description:
    "Conheça a Croebet. Você traz os palpites, a casa cuida dos Croins. Principalmente dos que eram seus.",
};

export default function About() {
  return (
    <PageShell>
      <div className="mx-auto max-w-[46rem]">
        <header>
          <Heading asChild variant="display">
            <h1>Seu azar. Nosso negócio.</h1>
          </Heading>
          <p className="mt-4 max-w-[55ch] text-lg text-muted">
            Você traz a confiança. A gente fica com os Croins.
            Cada um contribui com o que tem.
          </p>
        </header>

        <section className="mt-10" aria-labelledby="house-title">
          <Heading id="house-title">Uma casa com princípios. E interesses.</Heading>
          <p className="mt-3 leading-relaxed text-muted">
            A Croebet reúne jogos de cassino, palpites da comunidade e gente
            absolutamente convencida de que descobriu um método. Gostamos
            especialmente dessa última parte.
          </p>
          <p className="mt-3 leading-relaxed text-muted">
            Sob a administração da Croezinha, trabalhamos para que todo Croin
            encontre seu lugar. De preferência, no caixa da casa. Você pode
            discordar dessa filosofia. Inclusive, é o que torna tudo mais
            interessante.
          </p>
        </section>

        <Card asChild className="mt-7 p-5 sm:p-8">
          <section aria-labelledby="croins-title">
            <Heading className="text-xl" id="croins-title">
              Seu dinheiro não nos interessa
            </Heading>
            <p className="mt-2 leading-relaxed text-muted">
              Operamos exclusivamente com Croins, nossa moeda virtual sem
              valor monetário. Sem depósitos, compra de moedas ou saques em
              dinheiro real. Conseguimos ser gananciosos sem precisar do
              número do seu cartão. Questão de competência.
            </p>
          </section>
        </Card>

        <section className="mt-10" aria-labelledby="winners-title">
          <Heading id="winners-title">Ganhar é possível. Não precisa exagerar.</Heading>
          <p className="mt-3 leading-relaxed text-muted">
            Às vezes, alguém ganha. Respeitamos as regras, creditamos os Croins
            e seguimos em frente com a discrição que esse momento desagradável
            exige. Não espere fogos do departamento financeiro.
          </p>
          <p className="mt-3 leading-relaxed text-muted">
            Para quem perde, também há reconhecimento. O ranking de maiores
            perdedores existe porque certas contribuições merecem mais do que
            um simples obrigado.
          </p>
        </section>

        <section className="mt-10" aria-labelledby="purpose-title">
          <Heading id="purpose-title">O chat tem sempre um especialista</Heading>
          <p className="mt-3 leading-relaxed text-muted">
            Que horas começa a live? Vai ter peruca? Quanto tempo de atraso?
            Opinião nunca faltou. Agora ela pode vir acompanhada de Croins.
            A convicção continua sendo sua. O resultado costuma ter outras
            ideias.
          </p>
        </section>
      </div>
    </PageShell>
  );
}
