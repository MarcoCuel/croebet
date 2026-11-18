import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { WalletHistory } from "@/features/wallet/wallet-history";

export const metadata: Metadata = {
  title: "Histórico | Croebet",
  description: "Entradas e saídas dos seus Croins.",
};

export default function HistoryPage() {
  return (
    <PageShell className="pb-8">
      <h1 className="sr-only">Histórico</h1>
      <WalletHistory className="mt-0" />
    </PageShell>
  );
}
