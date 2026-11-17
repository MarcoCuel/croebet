import { PageShell } from "@/components/layout/page-shell";
import { Heading } from "@/components/shared/heading";
import type { Metadata } from "next";
import { Predictions } from "@/features/betting/predictions";

export const metadata: Metadata = {
  title: "Apostas | Croebet",
  description: "Palpites sobre política com Croins fictícios.",
};

export default function BettingPage() {
  return (
    <PageShell>
      <header data-enter>
        <Heading asChild variant="display">
          <h1>Apostas</h1>
        </Heading>
        <p className="mt-2 text-muted">
          Dê seu palpite sobre o próximo capítulo da novela de Brasília.
        </p>
        <p className="mt-2 text-sm text-muted">
          Cenários de demonstração. Todos os palpites usam Croins fictícios.
        </p>
      </header>
      <Predictions />
    </PageShell>
  );
}
