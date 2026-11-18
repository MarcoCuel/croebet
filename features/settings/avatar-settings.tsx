"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prepareAvatar } from "@/features/auth/avatar-storage";
import { useDemoSession } from "@/features/auth/session-context";

export function AvatarSettings() {
  const { username, avatar, updateAvatar } = useDemoSession();
  const input = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  // Ignore a pending image if this account section unmounts during decoding.
  const request = useRef(0);

  return (
    <div className="grid gap-3" role="group" aria-label="Foto de perfil">
      <p className="text-sm text-muted">Foto de perfil</p>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-16">
          {avatar && <AvatarImage src={avatar} alt="Sua foto de perfil" />}
          <AvatarFallback className="text-lg">{Array.from(username ?? "")[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback>
        </Avatar>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" loading={saving} onClick={() => input.current?.click()}>{avatar ? "Trocar foto" : "Adicionar foto"}</Button>
          {avatar && <Button variant="ghost" size="sm" disabled={saving} onClick={() => {
            try { updateAvatar(null); toast.success("Foto removida."); }
            catch { toast.error("Não foi possível remover a foto. Tente novamente."); }
          }}>Remover foto</Button>}
        </div>
      </div>
      <Input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Escolher foto de perfil" className="hidden" disabled={saving} onChange={async (event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        const current = ++request.current;
        setSaving(true);
        try {
          const image = await prepareAvatar(file);
          if (current !== request.current || !input.current) return;
          try { updateAvatar(image); }
          catch { throw new Error("Não foi possível salvar a foto. Verifique o espaço disponível no navegador."); }
          toast.success("Foto atualizada.");
        } catch (error) {
          if (input.current) toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a foto.");
        } finally {
          if (input.current) setSaving(false);
        }
      }} />
    </div>
  );
}
