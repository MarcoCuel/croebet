"use client";
import { ImagePicker } from "@/features/media/image-picker";
import { AdminGameHistory } from "./admin-game-history";
import { SeoEditor } from "./seo-fields";
import { seoFieldsSchema } from "@croebet/shared";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { gameCreateSchema, gameSchema, gameWriteSchema, type GameRecord } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { GameCover } from "@/features/games/game-cover";
import { managementRequest } from "@/features/admin/management-api";

export function AdminGameEditor({ game }: { game?: GameRecord }) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState(game?.imageUrl ?? "");
  const [seo, setSeo] = useState(game?.seo ?? seoFieldsSchema.parse({}));
  const [pending, setPending] = useState(false);
  return <div className="grid gap-6"><Card>
    <form className="grid items-start gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]" onSubmit={async event => {
      event.preventDefault();
      if (pending) return;
      const form = new FormData(event.currentTarget);
      const fields = { seo, name: form.get("name"), description: form.get("description"), enabled: form.get("enabled") === "on", imageUrl: imageUrl || null };
      const parsed = game ? gameWriteSchema.safeParse({ ...fields, version: game.version }) : gameCreateSchema.safeParse({ ...fields, slug: form.get("slug") });
      if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
      setPending(true);
      try {
        await managementRequest(game ? `/admin/games/${game.id}` : "/admin/games", gameSchema, game ? "PATCH" : "POST", parsed.data);
        toast.success(game ? "Jogo salvo." : "Jogo criado."); router.push("/admin/jogos"); router.refresh();
      } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o jogo."); }
      finally { setPending(false); }
    }}>
      <GameCover name={game?.name ?? "Novo jogo"} imageUrl={imageUrl || null} />
      <div className="grid gap-5">
        <h1 className="text-xl font-semibold">{game ? "Editar jogo" : "Criar jogo"}</h1>
        <Field>Nome do jogo<Input name="name" defaultValue={game?.name} required maxLength={100} /></Field>
        {!game && <Field>Endereço do jogo<Input name="slug" required maxLength={100} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="meu-jogo" /></Field>}
        <Field>Descrição<Textarea name="description" defaultValue={game?.description} maxLength={2000} rows={4} /></Field>
        <div className="grid gap-1.5"><p className="text-sm font-semibold">Imagem de capa</p><ImagePicker value={imageUrl} onChange={setImageUrl} label="Imagem de capa" disabled={pending} /></div>
        <Field className="flex items-center justify-between">Jogo ativo<Switch name="enabled" defaultChecked={game?.enabled ?? true} /></Field>
        <SeoEditor value={seo} onChange={setSeo} />
        <Button type="submit" loading={pending} disabled={pending} className="justify-self-start">{game ? "Salvar jogo" : "Criar jogo"}</Button>
      </div>
    </form>
  </Card>{game && <AdminGameHistory gameId={game.id} />}</div>;
}
