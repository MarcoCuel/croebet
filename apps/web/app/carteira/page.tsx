import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { getWalletHistory } from "@/features/wallet/server-wallet";
import { WalletHistory } from "@/features/wallet/wallet-history";

export const metadata: Metadata = {
  title: "Carteira · Croebet",
  description: "Entradas e saídas dos seus Croins.",
};

export default async function WalletPage({ searchParams }: { searchParams: Promise<{ direction?: string }> }) {
  const query = await searchParams;
  const direction = query.direction === "income" || query.direction === "expense" ? query.direction : "all";
  const initial = await getWalletHistory(direction);
  const now = new Date().toISOString();
  return (
    <PageShell className="pb-8">
      <h1 className="sr-only">Carteira</h1>
      <WalletHistory key={`${direction}:${now}`} initial={initial} direction={direction} now={now} />
    </PageShell>
  );
}
