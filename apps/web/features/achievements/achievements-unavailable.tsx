"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
export function AchievementsUnavailable() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <EmptyState title="Não foi possível carregar suas conquistas." description="Seu progresso continua guardado. Tente novamente." action={<Button variant="secondary" loading={pending} onClick={()=>startTransition(()=>router.refresh())}>Tentar novamente</Button>} />;
}
