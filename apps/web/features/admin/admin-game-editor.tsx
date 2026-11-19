"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { gameSchema, gameWriteSchema, type GameRecord } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { GameCover } from "@/features/games/game-cover";
import { managementRequest } from "@/features/admin/management-api";

export function AdminGameEditor({ game }: { game: GameRecord }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return <Card>
    <form className="grid items-start gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]" onSubmit={async event => {
      event.preventDefault();
      if (pending) return;
      const form = new FormData(event.currentTarget);
      const parsed = gameWriteSchema.safeParse({ name: form.get("name"), enabled: form.get("enabled") === "on", imageUrl: String(form.get("imageUrl") ?? "").trim() || null, version: game.version });
      if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
      setPending(true);
      try {
        await managementRequest(`/admin/games/${game.slug}`, gameSchema, "PATCH", parsed.data);
        toast.success("Jogo salvo."); router.push("/admin/jogos"); router.refresh();
      } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o jogo."); }
      finally { setPending(false); }
    }}>
      <GameCover name={game.name} imageUrl={game.imageUrl} />
      <div className="grid gap-5">
        <h1 className="text-xl font-semibold">Editar jogo</h1>
        <Field>Nome do jogo<Input name="name" defaultValue={game.name} required maxLength={100} /></Field>
        <Field>Imagem de capa<Input name="imageUrl" defaultValue={game.imageUrl ?? ""} placeholder="https://…" maxLength={2048} /></Field>
        <Field className="flex items-center justify-between">Jogo ativo<Switch name="enabled" defaultChecked={game.enabled} /></Field>
        <Button type="submit" loading={pending} disabled={pending} className="justify-self-start">Salvar jogo</Button>
      </div>
    </form>
  </Card>;
}
