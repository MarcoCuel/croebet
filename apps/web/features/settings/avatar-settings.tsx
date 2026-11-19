"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/features/auth/session-context";

export function AvatarSettings({ variant = "settings" }: { variant?: "settings" | "profile" }) {
  const { displayName, avatar, updateAvatar } = useSession();
  const input = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  // Ignore a pending image if this account section unmounts during decoding.
  const request = useRef(0);

  return (
    <>
      {variant === "profile" ? (
        <Button
          variant="secondary"
          size="icon"
          aria-label="Alterar foto de perfil"
          loading={saving}
          onClick={() => input.current?.click()}
          className="absolute -top-3 -right-3 rounded-full backdrop-blur-sm opacity-0 transition-opacity group-hover/avatar:opacity-100 group-focus-within/avatar:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100"
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
      ) : (
        <div className="grid gap-3" role="group" aria-label="Foto de perfil">
          <p className="text-sm text-muted">Foto de perfil</p>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="size-16">
              {avatar && <AvatarImage src={avatar} alt="Sua foto de perfil" />}
              <AvatarFallback className="text-lg">{Array.from(displayName ?? "")[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback>
            </Avatar>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" loading={saving} onClick={() => input.current?.click()}>{avatar ? "Trocar foto" : "Adicionar foto"}</Button>
              {avatar && <Button variant="ghost" size="sm" disabled={saving} onClick={async () => {
                setSaving(true);
                try { await updateAvatar(null); toast.success("Foto removida."); }
                catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível remover a foto. Tente novamente."); }
                finally { setSaving(false); }
              }}>Remover foto</Button>}
            </div>
          </div>
        </div>
      )}
      <Input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Escolher foto de perfil" className="hidden" disabled={saving} onChange={async (event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        const current = ++request.current;
        setSaving(true);
        try {
          if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Escolha uma imagem JPG, PNG ou WebP.");
          if (file.size > 10 * 1024 * 1024) throw new Error("Escolha uma imagem de até 10 MB.");
          await updateAvatar(file);
          if (current !== request.current || !input.current) return;
          toast.success("Foto atualizada.");
        } catch (error) {
          if (input.current) toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a foto.");
        } finally {
          if (input.current) setSaving(false);
        }
      }} />
    </>
  );
}
