import { PageShell } from "@/components/layout/page-shell";
import { AboutContent } from "@/features/about/about-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sobre | Croebet",
  description:
    "Conheça a Croebet. Você traz os palpites, a casa cuida dos Croins. Principalmente dos que eram seus.",
};

export default function About() {
  return (
    <PageShell>
      <AboutContent />
    </PageShell>
  );
}
