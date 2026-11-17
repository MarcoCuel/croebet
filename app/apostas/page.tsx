import { PageShell } from "@/components/layout/page-shell";
import { Heading } from "@/components/shared/heading";
import type { Metadata } from "next";
import { Predictions } from "@/features/betting/predictions";

export const metadata: Metadata = {
  title: "Apostas | Croebet",
  description: "Palpites sobre as lives e a comunidade com Croins fictícios.",
};

export default function BettingPage() {
  return (
    <PageShell>
      <header>
        <Heading asChild variant="display">
          <h1>Apostas</h1>
        </Heading>
      </header>
      <Predictions />
    </PageShell>
  );
}
