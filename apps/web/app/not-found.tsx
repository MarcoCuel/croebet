import Link from "next/link";
import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { Heading } from "@/components/shared/heading";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Página não encontrada · Croebet" };

export default function NotFound() {
  return (
    <PageShell className="flex items-center justify-center py-16">
      <section className="w-full max-w-md text-center" aria-labelledby="not-found-title">
        <h1 className="text-display leading-tight font-bold tracking-display text-brand">
          404
        </h1>
        <Heading id="not-found-title" className="mt-4">
          Página não encontrada
        </Heading>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Essa página não existe. Até a casa perde alguma coisa de vez em quando.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Button asChild>
            <Link href="/">Voltar ao início</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/jogos">Explorar jogos</Link>
          </Button>
        </div>
      </section>
    </PageShell>
  );
}
