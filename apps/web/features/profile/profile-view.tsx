"use client";

import { useEffect, useState } from "react";
import { publicProfileSchema, type PublicProfile } from "@croebet/shared";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AccountAvatarImage } from "@/features/auth/account-avatar-image";
import { useDemoSession } from "@/features/auth/session-context";
import { AvatarSettings } from "@/features/settings/avatar-settings";

export function ProfileView({ username }: { username: string }) {
  const router = useRouter();
  const { username: currentUsername } = useDemoSession();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError(null);
      try {
        const response = await fetch(`/api/v1/profiles/${encodeURIComponent(username)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 404) {
          setError("Perfil não encontrado.");
          return;
        }
        if (!response.ok) throw new Error("Serviço indisponível");
        const data = publicProfileSchema.parse(await response.json());
        if (!controller.signal.aborted) {
          setProfile(data);
          if (username !== data.username) router.replace(`/perfil/${encodeURIComponent(data.username)}`);
        }
      } catch {
        if (!controller.signal.aborted) setError("Não foi possível carregar este perfil.");
      }
    }
    void load();
    return () => controller.abort();
  }, [username, attempt, router]);

  if (error) return (
    <section className="flex flex-col items-center gap-4 py-16 text-center" aria-live="polite">
      <h1 className="text-xl font-semibold">{error}</h1>
      {error !== "Perfil não encontrado." && (
        <Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Button>
      )}
    </section>
  );

  if (!profile) return <p role="status" className="py-16 text-center text-sm text-muted">Carregando perfil…</p>;

  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center py-12 text-center sm:py-16">
      <div className="group/avatar relative">
        <Avatar className="size-24" aria-hidden="true">
          <AccountAvatarImage name={profile.username} src={profile.avatarUrl} />
          <AvatarFallback className="text-3xl">{Array.from(profile.displayName)[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback>
        </Avatar>
        {currentUsername?.toLowerCase() === profile.username.toLowerCase() && (
          <AvatarSettings variant="profile" />
        )}
      </div>
      <h1 className="mt-5 max-w-full text-2xl font-semibold wrap-anywhere">{profile.displayName}</h1>
      <p className="mt-2 max-w-full text-sm text-muted wrap-anywhere">@{profile.username}</p>
    </section>
  );
}
