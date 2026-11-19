"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-context";

export function OwnProfile() {
  const { username, sessionReady, openLogin } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (username) router.replace(`/perfil/${encodeURIComponent(username)}`);
  }, [username, router]);

  if (!sessionReady || username) return <p role="status" className="py-16 text-center text-sm text-muted">Carregando perfil…</p>;
  return (
    <section className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Entre para ver seu perfil</h1>
      <Button onClick={openLogin}>Entrar</Button>
    </section>
  );
}
