import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { Heading } from "@/components/shared/heading";
import { WalletHistory } from "@/features/wallet/wallet-history";

export const metadata: Metadata = {
  title: "Histórico | Croebet",
  description: "Entradas e saídas dos seus Croins fictícios.",
};

export default function HistoryPage() {
  return (
    <PageShell className="pb-8">
      <Heading asChild variant="display"><h1>Histórico</h1></Heading>
      <WalletHistory />
    </PageShell>
  );
}
