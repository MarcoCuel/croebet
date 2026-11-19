"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ProfileUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <section className="flex flex-col items-center gap-4 py-16 text-center" aria-live="polite">
      <h1 className="text-xl font-semibold">Não foi possível carregar este perfil.</h1>
      <Button variant="secondary" loading={pending} onClick={() => startTransition(() => router.refresh())}>
        Tentar novamente
      </Button>
    </section>
  );
}
