"use client";

import { useId, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type BetInputProps = {
  value: number;
  onValueChange: (value: number) => void;
  presets: readonly number[];
  label?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
};

/** Commits manual edits on blur/Enter; buttons commit immediately. Amounts are integers. */
export function BetInput({ value, onValueChange, presets, label = "Valor da aposta", min = 1, max = Number.MAX_SAFE_INTEGER, disabled, className }: BetInputProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const valid = (amount: number) => Number.isSafeInteger(amount) && amount >= min && amount <= max;
  const current = draft !== null && draft.trim() !== "" && valid(Number(draft)) ? Number(draft) : value;
  const commit = (amount: number) => {
    setDraft(null);
    if (!disabled && valid(amount) && amount !== value) onValueChange(amount);
  };
  return <div ref={root} className={cn("min-w-0 space-y-2", className)}>
    <Field htmlFor={id}>{label}</Field>
    <div className="flex min-w-0 items-center rounded-lg border border-transparent bg-contrast/6 focus-within:border-field-border">
      <Button variant="ghost" size="icon" className="rounded-lg" aria-label="Diminuir aposta" disabled={disabled || current <= min} onClick={() => commit(Math.max(min, current - 1))}><Minus className="size-4" aria-hidden="true" /></Button>
      <Input id={id} type="number" inputMode="numeric" min={min} max={max} step={1} disabled={disabled}
        className="rounded-none border-0 bg-transparent px-1 text-center font-semibold tabular-nums focus-visible:border-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={draft ?? String(value)} aria-invalid={draft !== null && (draft.trim() === "" || !valid(Number(draft))) || undefined}
        onChange={event => setDraft(event.target.value)}
        onBlur={event => {
          // Moving to a step/preset button lets that action commit the draft once.
          if (event.relatedTarget instanceof Node && root.current?.contains(event.relatedTarget)) return;
          commit(event.currentTarget.value.trim() === "" ? NaN : Number(event.currentTarget.value));
        }}
        onKeyDown={event => {
          if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
          if (event.key === "Escape") { event.preventDefault(); setDraft(null); }
        }} />
      <Button variant="ghost" size="icon" className="rounded-lg" aria-label="Aumentar aposta" disabled={disabled || current >= max} onClick={() => commit(Math.min(max, current + 1))}><Plus className="size-4" aria-hidden="true" /></Button>
    </div>
    <div className="grid grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))] gap-1.5" role="group" aria-label="Valores de aposta sugeridos">
      {[...new Set(presets)].filter(valid).map(amount => <Button key={amount} variant={amount === value ? "default" : "secondary"} className="min-h-11 rounded-lg px-1 py-2 tabular-nums" disabled={disabled} aria-label={`Apostar ${amount} Croins`} aria-pressed={amount === value} onClick={() => commit(amount)}>{amount}</Button>)}
    </div>
  </div>;
}
