"use client";

import { useEffect, useRef, useState } from "react";
import { profileSchema } from "@croebet/shared";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSession } from "@/features/auth/session-context";

export function ProfileOnboarding({ remindAt, onDefer, onComplete }: { remindAt: string | null; onDefer: () => Promise<void>; onComplete: () => void }) {
  const { username, avatar, updateDisplayName, updateAvatar } = useSession();
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const [due, setDue] = useState(() => !remindAt || Date.parse(remindAt) <= Date.now());

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);
  useEffect(() => {
    if (!remindAt) return;
    const timer = setTimeout(() => setDue(true), Math.max(0, Date.parse(remindAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [remindAt]);

  async function defer() {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    try { await onDefer(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível adiar. Tente novamente."); }
    finally { pending.current = false; setSaving(false); }
  }

  if (!due) return null;

  return (
    <Dialog open onOpenChange={open => { if (!open) void defer(); }}>
      <DialogContent aria-describedby={undefined} showCloseButton={!saving}>
        <DialogTitle>Como você quer aparecer?</DialogTitle>
        <form className="mt-5 grid gap-5" onSubmit={async event => {
          event.preventDefault();
          if (pending.current) return;
          const parsed = profileSchema.safeParse({ displayName: name });
          if (!parsed.success) {
            toast.error("Digite um nome de 1 a 40 caracteres válidos.");
            return;
          }
          if (!photo && !avatar) {
            toast.error("Adicione uma foto para completar seu perfil.");
            return;
          }
          pending.current = true;
          setSaving(true);
          try {
            await updateDisplayName(parsed.data.displayName);
            if (photo) await updateAvatar(photo.file);
            onComplete();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Não foi possível salvar seu perfil.");
          } finally {
            pending.current = false;
            setSaving(false);
          }
        }}>
          <div className="flex flex-wrap items-center gap-4" role="group" aria-label="Avatar">
            <Avatar className="size-20">
              {(photo?.url ?? avatar) && <AvatarImage src={photo?.url ?? avatar ?? undefined} alt="Seu avatar" />}
              <AvatarFallback className="text-2xl">{Array.from(name.trim() || username || "")[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback>
            </Avatar>
            <div className="grid gap-1">
              <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={() => input.current?.click()}>
                {photo || avatar ? "Trocar foto" : "Adicionar foto"}
              </Button>
              {photo && <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => setPhoto(null)}>Remover foto</Button>}
            </div>
            <Input ref={input} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Escolher avatar" className="hidden" disabled={saving} onChange={event => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (!file) return;
              if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                toast.error("Escolha uma imagem JPG, PNG ou WebP.");
                return;
              }
              if (file.size > 10 * 1024 * 1024) {
                toast.error("Escolha uma imagem de até 10 MB.");
                return;
              }
              setPhoto({ file, url: URL.createObjectURL(file) });
            }} />
          </div>
          <Field>
            Nome
            <Input name="displayName" autoComplete="nickname" value={name} onChange={event => setName(event.target.value)} maxLength={40} required disabled={saving} />
          </Field>
          <div className="grid gap-2">
            <Button type="submit" loading={saving}>Salvar e continuar</Button>
            <Button type="button" variant="ghost" size="sm" className="justify-self-center" disabled={saving} onClick={() => void defer()}>Agora não</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
