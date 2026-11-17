import { PageShell } from "@/components/layout/page-shell";
import { Heading } from "@/components/shared/heading";
import { Card } from "@/components/ui/card";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Rankings | Croebet" };

export default function Rankings() {
  return (
    <PageShell>
      <Heading asChild variant="display">
        <h1>Rankings</h1>
      </Heading>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {["Maiores ganhadores", "Maiores perdedores"].map((title) => (
          <Card asChild key={title}>
            <section>
              <Heading>{title}</Heading>
              <p className="mt-2 text-sm text-muted">
                A classificação da comunidade ainda está em preparação.
              </p>
            </section>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
