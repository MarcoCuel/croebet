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
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { commandResultSchema } from "@croebet/shared";
import { managementRequest } from "@/features/admin/management-api";

export function AdminGameEditor({ game }: { game?: GameRecord }) {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState(game?.imageUrl ?? "");
  const [seo, setSeo] = useState(game?.seo ?? seoFieldsSchema.parse({}));
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(false);
  const [autoSlug, setAutoSlug] = useState("");
  const [customSlug, setCustomSlug] = useState<string | null>(null);
  return <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
    <div className="grid min-w-0 gap-4">
      <form id="game-editor" className="min-w-0" onSubmit={async event => {
        event.preventDefault();
        if (pending) return;
        const form = new FormData(event.currentTarget);
        const fields = { fallbackDurationMinutes: form.get("fallbackDurationMinutes") ? Number(form.get("fallbackDurationMinutes")) : null, seo, name: form.get("name"), description: form.get("description"), enabled: form.get("enabled") === "on", imageUrl: imageUrl || null };
        const parsed = game ? gameWriteSchema.safeParse({ ...fields, slug: customSlug ?? game.slug, version: game.version }) : gameCreateSchema.safeParse({ ...fields, slug: customSlug ?? normalizeSlug(String(form.get("name") ?? "")) });
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
        <Field>Endereço do jogo<SlugInput form="game-editor" name="slug" value={customSlug ?? game?.slug ?? autoSlug} onValueChange={setCustomSlug} required={!!game || customSlug !== null} maxLength={100} placeholder="meu-jogo" /></Field>
        <Field>Duração padrão (minutos)<Input form="game-editor" name="fallbackDurationMinutes" type="number" min={1} max={10080} step={1} defaultValue={game?.fallbackDurationMinutes ?? ""} placeholder="Sem estimativa" /><span className="text-xs text-muted">Usada quando não há partidas concluídas com duração registrada, oficiais ou de teste.</span></Field>
        <div className="grid gap-1.5"><p className="text-sm font-semibold">Imagem de capa</p><ImagePicker value={imageUrl} onChange={setImageUrl} label="Imagem de capa" disabled={pending} /></div>
      </Card>
      <SeoEditor variant="card" form="game-editor" value={seo} onChange={setSeo} disabled={pending} />
      {game && <Button variant="outline" size="sm" disabled={pending} onClick={() => setDeleting(true)}>Excluir jogo</Button>}
    </aside>
    <Dialog open={deleting} onOpenChange={open => { if (!pending) setDeleting(open); }}>
      <DialogContent>
        <DialogTitle>Excluir jogo?</DialogTitle>
        <DialogDescription>O jogo será removido do catálogo. O histórico de partidas e a auditoria serão preservados. Salas e partidas em andamento precisam ser encerradas antes.</DialogDescription>
        <div className="flex justify-end gap-3">
          <Button variant="outline" disabled={pending} onClick={() => setDeleting(false)}>Cancelar</Button>
          <Button loading={pending} disabled={pending} onClick={async () => {
            if (!game || pending) return;
            setPending(true);
            try {
              await managementRequest(`/admin/games/${game.id}`, commandResultSchema, "DELETE", { version: game.version });
              toast.success("Jogo excluído."); router.replace("/admin/jogos"); router.refresh();
            } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir o jogo."); }
            finally { setPending(false); }
          }}>Excluir jogo</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}
