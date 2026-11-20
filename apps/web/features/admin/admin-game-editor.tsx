"use client";
import { ImagePicker } from "@/features/media/image-picker";
import { AdminGameHistory } from "./admin-game-history";
import { SeoEditor } from "./seo-fields";
import { normalizeSlug, seoFieldsSchema } from "@croebet/shared";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { gameCreateSchema, gameSchema, gameWriteSchema, type GameRecord } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SlugInput } from "@/components/ui/slug-input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { EditableRow } from "@/components/shared/editable-row";
import { managementRequest } from "@/features/admin/management-api";

export function AdminGameEditor({ game }: { game?: GameRecord }) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState(game?.imageUrl ?? "");
  const [seo, setSeo] = useState(game?.seo ?? seoFieldsSchema.parse({}));
  const [pending, setPending] = useState(false);
  const [autoSlug, setAutoSlug] = useState("");
  const [customSlug, setCustomSlug] = useState<string | null>(null);
  return <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
    <div className="grid min-w-0 gap-4">
      <form id="game-editor" className="min-w-0" onSubmit={async event => {
        event.preventDefault();
        if (pending) return;
        const form = new FormData(event.currentTarget);
        const fields = { seo, name: form.get("name"), description: form.get("description"), enabled: form.get("enabled") === "on", imageUrl: imageUrl || null };
        const parsed = game ? gameWriteSchema.safeParse({ ...fields, version: game.version }) : gameCreateSchema.safeParse({ ...fields, slug: customSlug ?? normalizeSlug(String(form.get("name") ?? "")) });
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        setPending(true);
        try {
          await managementRequest(game ? `/admin/games/${game.id}` : "/admin/games", gameSchema, game ? "PATCH" : "POST", parsed.data);
          toast.success(game ? "Jogo salvo." : "Jogo criado."); router.push("/admin/jogos"); router.refresh();
        } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o jogo."); }
        finally { setPending(false); }
      }}>
        <Card className="grid min-w-0 gap-4" inert={pending}>
          <h1 className="sr-only">{game ? "Editar jogo" : "Criar jogo"}</h1>
          <Field>Nome do jogo<Input name="name" defaultValue={game?.name} required maxLength={100} onBlur={event => setAutoSlug(normalizeSlug(event.currentTarget.value))} /></Field>
          <Field>Descrição<Textarea name="description" defaultValue={game?.description} maxLength={2000} rows={12} /></Field>
        </Card>
      </form>
      {game && <AdminGameHistory gameId={game.id} />}
    </div>
    <aside className="grid min-w-0 gap-4 xl:sticky xl:top-[var(--header-height)]" aria-label="Configurações do jogo">
      <Button type="submit" form="game-editor" loading={pending} disabled={pending}>{game ? "Salvar jogo" : "Criar jogo"}</Button>
      <Card className="grid min-w-0 gap-4" inert={pending}>
        <Field className="flex items-center justify-between">Jogo ativo<Switch form="game-editor" name="enabled" defaultChecked={game?.enabled ?? true} /></Field>
        {game ? <EditableRow label="Slug" value={game.slug} /> : <Field>Endereço do jogo<SlugInput form="game-editor" name="slug" value={customSlug ?? autoSlug} onValueChange={setCustomSlug} required={customSlug !== null} maxLength={100} placeholder="meu-jogo" /></Field>}
        <div className="grid gap-1.5"><p className="text-sm font-semibold">Imagem de capa</p><ImagePicker value={imageUrl} onChange={setImageUrl} label="Imagem de capa" disabled={pending} /></div>
      </Card>
      <SeoEditor variant="card" form="game-editor" value={seo} onChange={setSeo} disabled={pending} />
    </aside>
  </div>;
}
