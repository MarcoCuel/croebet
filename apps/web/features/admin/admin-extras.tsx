"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { bonusWindowSettingsSchema, type BonusWindow, type BonusWindowSettings } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { managementRequest } from "./management-api";

const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
function suggestedWindow(windows: BonusWindow[]): BonusWindow {
  const last = windows.at(-1);
  if (!last) return { start: "18:00", end: "19:00" };
  const [hour, minute] = last.end.split(":").map(Number);
  const start = hour! * 60 + minute!;
  const end = Math.min(start + 60, 23 * 60 + 59);
  return end > start ? { start: clock(start), end: clock(end) } : { start: "18:00", end: "19:00" };
}

export function AdminExtras({ initial }: { initial: BonusWindowSettings }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, setPending] = useState(false);
  const dirty = JSON.stringify({ enabled: value.enabled, windows: value.windows })
    !== JSON.stringify({ enabled: saved.enabled, windows: saved.windows });

  function updateWindow(index: number, patch: Partial<BonusWindow>) {
    setValue(current => ({ ...current, windows: current.windows.map((window, position) => position === index ? { ...window, ...patch } : window) }));
  }

  async function save() {
    const parsed = bonusWindowSettingsSchema.safeParse(value);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Confira os horários."); return; }
    setPending(true);
    try {
      const next = await managementRequest("/admin/bonus-windows", bonusWindowSettingsSchema, "PATCH", parsed.data);
      setValue(next); setSaved(next);
      toast.success("Horário bugado salvo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally { setPending(false); }
  }

  return <div className="grid min-w-0 gap-5">
    <h1 className="sr-only">Extras</h1>
    <Card className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-semibold">Horário bugado</h2>
          <p className="mt-1 max-w-prose text-sm text-muted">
            Durante as janelas ligadas, o limite do bônus diário sobe para dois resgates no mesmo dia.
            O segundo resgate fica registrado no extrato como horário bugado. Fora das janelas, continua um resgate por dia.
            Horários de São Paulo.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <Switch checked={value.enabled} disabled={pending} aria-label="Horário bugado"
            onCheckedChange={enabled => setValue(current => ({ ...current, enabled }))} />
          {value.enabled ? "Ligado" : "Desligado"}
        </label>
      </div>
      <div className="mt-5 grid gap-3">
        {value.windows.map((window, index) => <div key={index} className="flex flex-wrap items-end gap-2 border-t border-contrast/6 pt-3 first:border-0 first:pt-0">
          <Field className="w-32">Início<Input type="time" step={60} value={window.start} disabled={pending}
            onChange={event => updateWindow(index, { start: event.target.value })} /></Field>
          <Field className="w-32">Término<Input type="time" step={60} value={window.end} disabled={pending}
            onChange={event => updateWindow(index, { end: event.target.value })} /></Field>
          <Button type="button" variant="ghost" size="icon" aria-label={`Remover janela ${index + 1}`} disabled={pending}
            onClick={() => setValue(current => ({ ...current, windows: current.windows.filter((_, position) => position !== index) }))}>
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>)}
        {value.windows.length === 0 && <p className="text-sm text-muted">Sem janelas configuradas, o segundo resgate não é liberado mesmo com a opção ligada.</p>}
        {value.windows.length < 8 && <div>
          <Button type="button" variant="outline" size="sm" disabled={pending}
            onClick={() => setValue(current => ({ ...current, windows: [...current.windows, suggestedWindow(current.windows)] }))}>
            <Plus className="size-4" aria-hidden="true" />
            Adicionar janela
          </Button>
        </div>}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={save} loading={pending} disabled={!dirty}>Salvar alterações</Button>
        {dirty && <p className="text-sm text-muted">Alterações não salvas.</p>}
      </div>
    </Card>
  </div>;
}
