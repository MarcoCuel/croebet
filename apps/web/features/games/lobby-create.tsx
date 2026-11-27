"use client";

import type { Dispatch, SetStateAction } from "react";
import { gameOptionsForPlayers, gameOptionsSchema, maxGamePlayers, settingValue, visibleSettings, type Economy, type GameDefinition, type Lobby } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BetInput } from "@/components/ui/bet-input";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Choice = Partial<Lobby["options"] & { count: number }>;

export function LobbyCreateDialog({
  open,
  onOpenChange,
  definition,
  settings,
  capacity,
  entry,
  bots,
  onlyBots,
  development,
  economy,
  busy,
  connected,
  error,
  editing = false,
  onChange,
  onBots,
  onOnlyBots,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: GameDefinition;
  settings: Lobby["options"];
  capacity: number;
  entry: number;
  bots: number;
  onlyBots: boolean;
  development: boolean;
  economy: Economy | null;
  busy: boolean;
  connected: boolean;
  error: string;
  editing?: boolean;
  onChange: (settings: Lobby["options"], capacity: number, entry: number, choice: Choice) => void;
  onBots: Dispatch<SetStateAction<number>>;
  onOnlyBots: Dispatch<SetStateAction<boolean>>;
  onCreate: () => void;
}) {
  const limit = maxGamePlayers(definition, settings);
  return <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
    <DialogContent aria-describedby={undefined} className="w-[min(30rem,calc(100%-2rem))]">
      <DialogTitle>{editing ? "Editar partida" : "Configurar sala"}</DialogTitle>
      <form className="mt-5 grid gap-4" onSubmit={event => { event.preventDefault(); if (editing) onOpenChange(false); else onCreate(); }}>
        <fieldset disabled={busy} className="grid min-w-0 gap-4">
          {visibleSettings(definition, settings).map(field => {
            const value = settingValue(settings, field.key);
            const change = (next: string | boolean) => {
              const choice = { ...field.reset, [field.key]: next };
              const options = gameOptionsSchema.parse(definition.options.parse({ ...settings, ...choice }));
              const count = Math.min(capacity, definition.maxPlayers(options));
              onChange(options, count, entry, { ...choice, count });
            };
            return <Field key={field.key} className="grid-cols-[1fr_auto] items-center gap-4">{field.label}{field.type === "select"
              ? <Select className="max-w-full" aria-label={field.ariaLabel ?? field.label} value={String(value)} onChange={event => change(event.target.value)}>{field.choices?.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</Select>
              : <Switch aria-label={field.label} checked={value === true} onCheckedChange={change} />}</Field>;
          })}
          <Field className="grid-cols-[1fr_auto] items-center gap-4">Número de jogadores<Select className="w-20" aria-label="Número de jogadores" value={capacity} onChange={event => {
            const count = Number(event.target.value);
            const options = gameOptionsForPlayers(definition, settings, count);
            onChange(options, count, entry, { ...options, count });
          }}>{Array.from({ length: limit - definition.minPlayers + 1 }, (_, index) => index + definition.minPlayers).map(count => <option key={count} value={count}>{count}</option>)}</Select></Field>
          {!development && definition.croins && <div className="min-w-0 space-y-4 rounded-xl bg-contrast/6 p-4" role="group" aria-label="Aposta da partida">
            <Field className="grid-cols-[1fr_auto] items-center gap-3">Jogar apostando<Switch aria-label="Jogar apostando" checked={entry > 0} disabled={!economy && !entry} onCheckedChange={enabled => { if (!enabled || economy) onChange(settings, capacity, enabled ? economy!.defaultBet : 0, {}); }} /></Field>
            {entry > 0 && <BetInput label="Entrada por jogador" value={entry} presets={economy?.suggestedBets ?? []} disabled={busy} onValueChange={amount => onChange(settings, capacity, amount, {})} />}
          </div>}
          {development && !editing && <>
            <Field className="grid-cols-[1fr_auto] items-center gap-4">Bots<Select aria-label="Bots" value={bots} onChange={event => onBots(Number(event.target.value))}>{Array.from({ length: capacity + (onlyBots ? 1 : 0) }, (_, index) => index).filter(count => !onlyBots || count >= 2).map(count => <option key={count} value={count}>{count}</option>)}</Select></Field>
            <Field className="grid-cols-[1fr_auto] items-center gap-4">Somente bots<Switch aria-label="Somente bots" checked={onlyBots} onCheckedChange={value => { onOnlyBots(value); onBots(value ? capacity : 0); }} /></Field>
          </>}
        </fieldset>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {editing
          ? <Button type="button" className="w-full bg-tertiary text-white" disabled={busy} onClick={() => onOpenChange(false)}>Concluir</Button>
          : <Button type="submit" className="w-full bg-tertiary text-white" loading={busy} disabled={busy || !connected}>Criar sala</Button>}
      </form>
    </DialogContent>
  </Dialog>;
}
