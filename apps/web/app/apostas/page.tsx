import { PageShell } from "@/components/layout/page-shell";
import type { Metadata } from "next";
import { Predictions } from "@/features/betting/predictions";

export const metadata: Metadata = {
  title: "Apostas · Croebet",
  description: "Palpites sobre as lives e a comunidade com Croins.",
};

export default function BettingPage() {
  return (
    <PageShell>
      <h1 className="sr-only">Apostas</h1>
      <Predictions className="mt-0" />
    </PageShell>
  );
}
