import type { Metadata } from "next";
import { Predictions } from "./predictions";

export const metadata: Metadata = {
  title: "Apostas | Croebet",
  description: "Palpites sobre política com Croins fictícios.",
};

export default function BettingPage() {
  return (
    <main className="shell inner">
      <header data-enter>
        <h1 className="display-heading">Apostas</h1>
        <p className="mt-3.5 text-muted">Dê seu palpite sobre o próximo capítulo da novela de Brasília.</p>
        <p className="mt-2 text-sm text-muted">Cenários de demonstração. Todos os palpites usam Croins fictícios.</p>
      </header>
      <Predictions />
    </main>
  );
}
