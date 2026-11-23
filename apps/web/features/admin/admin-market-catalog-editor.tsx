"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { catalogMarketSchema, catalogMarketWriteSchema, catalogMarketStatuses, commandResultSchema, type CatalogMarket } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { managementRequest } from "@/features/admin/management-api";

function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function AdminMarketCatalogEditor({ market }: { market?: CatalogMarket }) {
  const router = useRouter();
  const [type, setType] = useState<CatalogMarket["type"]>(market?.type ?? "binary");
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return <div className="grid min-w-0 gap-5">
    <h1 className="sr-only">{market ? "Editar aposta" : "Nova aposta"}</h1>
    <Card>
      <form className="grid gap-5" onSubmit={async event => {
        event.preventDefault(); if (pending) return;
        const data = new FormData(event.currentTarget);
        const endsAt = String(data.get("endsAt") ?? "");
        const parsed = catalogMarketWriteSchema.safeParse({
          question: data.get("question"), criterion: data.get("criterion"), type,
          options: type === "number" ? [] : type === "binary" ? ["Sim", "Não"] : String(data.get("options") ?? "").split("\n").map(value => value.trim()).filter(Boolean),
          unit: type === "number" ? data.get("unit") : "", status: data.get("status"),
          endsAt: endsAt ? new Date(endsAt).toISOString() : null, version: market?.version ?? 0,
        });
        if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
        setPending(true);
        try {
          const saved = await managementRequest(market ? `/admin/markets/${market.id}` : "/admin/markets", catalogMarketSchema, market ? "PATCH" : "POST", parsed.data);
          toast.success(market ? "Aposta salva." : "Aposta criada.");
          router.replace(`/admin/apostas/${saved.id}`); router.refresh();
        } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); }
        finally { setPending(false); }
      }}>
        <Field>Pergunta<Input name="question" defaultValue={market?.question} maxLength={200} required disabled={pending} /></Field>
        <Field>Critério de apuração<Textarea name="criterion" defaultValue={market?.criterion} maxLength={4000} required disabled={pending} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>Formato<Select value={type} onChange={event => setType(event.target.value as CatalogMarket["type"])} disabled={pending}>
            <option value="binary">Sim ou não</option><option value="choice">Opções</option><option value="number">Número</option>
          </Select></Field>
          <Field>Status<Select name="status" defaultValue={market?.status ?? "draft"} disabled={pending}>
            {Object.entries(catalogMarketStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select></Field>
        </div>
        {type === "choice" && <Field>Opções (uma por linha)<Textarea name="options" defaultValue={market?.options.join("\n")} required disabled={pending} /></Field>}
        {type === "number" && <Field>Unidade<Input name="unit" defaultValue={market?.unit} maxLength={80} required disabled={pending} /></Field>}
        <Field>Encerramento<Input name="endsAt" type="datetime-local" defaultValue={localDate(market?.endsAt ?? null)} disabled={pending} /></Field>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={pending} disabled={pending}>{market ? "Salvar" : "Criar aposta"}</Button>
          {market && <Button type="button" variant="outline" disabled={pending} onClick={() => setDeleting(true)}>Excluir</Button>}
        </div>
      </form>
    </Card>
    <Dialog open={deleting} onOpenChange={setDeleting}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Excluir aposta?</DialogTitle>
        <Button variant="outline" loading={pending} disabled={pending} onClick={async () => {
          if (!market || pending) return; setPending(true);
          try {
            await managementRequest(`/admin/markets/${market.id}`, commandResultSchema, "DELETE", { version: market.version });
            toast.success("Aposta excluída."); router.replace("/admin/apostas"); router.refresh();
          } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível excluir."); }
          finally { setPending(false); }
        }}>Excluir</Button>
      </DialogContent>
    </Dialog>
  </div>;
}
