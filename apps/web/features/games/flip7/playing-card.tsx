"use client";

import { useId, type CSSProperties } from "react";
import { PlayingCardsFan, PlayingCard as PlayingCardIcon, Heart, Lock, Plus, Minus, Divide, ArrowLeftRight, Hand, ArrowUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardLabel, isNumber, type Card } from "./presentation";
import { numberColors } from "./card-colors";

const numberNames = ["Zero", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez", "Onze", "Doze", "Treze"];
export function PlayingCard({ card, flipped = false, compact = false, fluid = false, sideways = false }: { card: Card; flipped?: boolean; compact?: boolean; fluid?: boolean; sideways?: boolean }) {
  const gradientId = useId();
  const holographic = card.type === "lucky13" && !flipped;
  const special = ["freeze", "chance", "three", "one", "four", "steal", "swap", "remove"].includes(card.type);
  const numeric = isNumber(card);
  const Icon = card.type === "one" ? PlayingCardIcon : card.type === "freeze" ? Lock : card.type === "chance" ? Heart : card.type === "swap" ? ArrowLeftRight : card.type === "steal" ? Hand : card.type === "remove" ? ArrowUp : PlayingCardsFan;
  const color = card.type === "unlucky7" ? "silver" : numeric ? numberColors[card.value]
    : card.type === "freeze" || card.type === "one" ? "cyan"
    : card.type === "four" ? "yellow" : card.type === "three" || card.type === "steal" ? "amber"
    : card.type === "minus" || card.type === "halve" ? "red"
    : card.type === "swap" ? "lime" : card.type === "remove" ? "purple" : "orange";
  const label = card.type === "number" ? numberNames[card.value] : cardLabel(card);
  const zeroGradient = card.type === "zero" ? <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stopColor="var(--color-flip-cyan)" /><stop offset="35%" stopColor="var(--color-flip-pink)" /><stop offset="65%" stopColor="var(--color-flip-neutral)" /><stop offset="100%" stopColor="var(--color-flip-purple)" />
  </linearGradient></defs> : null;
  return (
    <div role="img" aria-label={flipped ? "Carta de costas" : cardLabel(card)} title={flipped ? undefined : cardLabel(card)}
      data-card-back={flipped || undefined}
      data-card-sideways={sideways || undefined}
      data-holographic={holographic || undefined}
      className={cn("relative @container shrink-0 font-sans normal-nums [perspective:50rem]", fluid ? sideways ? "aspect-[8/5] w-full sm:aspect-[3/2]" : "aspect-[5/8] w-full sm:aspect-[2/3]" : compact ? "h-14 w-9" : "h-32 w-20 sm:h-36 sm:w-24")}>
      <div className={cn("relative @container w-full aspect-[5/8] transition-transform duration-300 ease-in-out motion-reduce:transition-none sm:aspect-[2/3]", compact && "h-full aspect-auto sm:aspect-auto", sideways && "absolute top-1/2 left-1/2 w-[62.5%] -translate-x-1/2 -translate-y-1/2 rotate-90 sm:w-2/3")}>
      <div className={cn("relative size-full transition-transform duration-700 [transform-style:preserve-3d] motion-reduce:transition-none", flipped && "[transform:rotateY(180deg)]")}>
        <div aria-hidden={flipped} style={{ "--card-color": !compact && card.type === "chance" ? "var(--color-brand)" : `var(--color-flip-${color})` } as CSSProperties}
          className={cn("absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-flip-card shadow-md [backface-visibility:hidden] after:pointer-events-none after:absolute after:inset-0 after:z-20 after:rounded-[inherit] after:[box-shadow:var(--inset-shadow-flip-card)]",
            compact ? "rounded-md" : "rounded-[18cqi] text-(--card-color)",
            !compact && !numeric && "bg-(--card-color) text-white",
            compact && (numeric ? "text-(--card-color)" : "bg-(--card-color) text-white"),
            compact && card.type === "chance" && "bg-brand text-white",
            holographic && "bg-flip-ink text-white",
          )}>
          {holographic && <>
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-(image:--background-image-flip-holographic) bg-size-[250%_250%] bg-center opacity-60 motion-safe:animate-flip-holographic" />
          </>}
          {compact ? <>
            {numeric && <span className={cn("absolute top-1 right-1 z-10 size-1 rounded-full bg-(--card-color)", holographic && "bg-white")} aria-hidden="true" />}
            {special ? <Icon className="size-4 rotate-15" fill="none" aria-hidden="true" /> : card.type === "zero" ? <svg className="relative z-10 h-8 w-6 font-medium normal-nums" viewBox="0 0 24 32" aria-hidden="true">
              {zeroGradient}
              <text x="12" y="23" textAnchor="middle" fontSize={18} fill={`url(#${gradientId})`}>0</text>
            </svg> : <span className="relative z-10 text-lg font-medium normal-nums">{numeric ? card.value : cardLabel(card)}</span>}
          </> : <>
            <div className={cn("absolute inset-x-[12cqi] top-[12cqi] z-10 flex items-start justify-between gap-[6cqi]", special && "justify-center")}>
              <span className={cn("min-w-0 text-[16cqi] leading-none font-normal", numeric && "text-foreground", holographic && "text-white", special && "text-center", (["bonus", "double", "minus", "halve"].includes(card.type)) && "text-[32cqi]")}>
                {card.type === "bonus" ? <Plus className="block size-[24cqi]" aria-hidden="true" /> : card.type === "minus" ? <Minus className="block size-[24cqi]" aria-hidden="true" /> : card.type === "halve" ? <Divide className="block size-[24cqi]" aria-hidden="true" /> : card.type === "double" ? <X className="block size-[24cqi]" aria-hidden="true" /> : card.type === "chance" ? <>Segunda<br />Chance</> : label}
              </span>
              {numeric && <span className={cn("size-[11cqi] shrink-0 rounded-full bg-(--card-color)", holographic && "bg-white")} aria-hidden="true" />}
            </div>
            {special ? <Icon className="absolute -bottom-[28cqi] left-[8cqi] size-[112cqi] rotate-15" strokeWidth={1.5} fill="none" aria-hidden="true" /> : <svg className="absolute inset-0 size-full overflow-visible font-normal normal-nums" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true">
              {zeroGradient}
              <text x="50" y="155" textAnchor="middle" fill={card.type === "zero" ? `url(#${gradientId})` : "currentColor"} fontSize={126} letterSpacing="-0.05em">{card.type === "double" || card.type === "halve" ? 2 : card.value}</text>
            </svg>}
          </>}
        </div>
        <div aria-hidden="true" className={cn("absolute inset-0 overflow-hidden bg-flip-card-back [box-shadow:var(--inset-shadow-flip-card)] [backface-visibility:hidden] [transform:rotateY(180deg)]", compact ? "rounded-md" : "rounded-[18cqi]")}>
          <span className={cn("absolute flex items-center justify-center bg-flip-card-inset overflow-hidden", compact ? "inset-1 rounded-sm" : "inset-2.5 rounded-[12cqi]")}>
            <span className={cn("rotate-12 font-bold leading-none text-contrast/6", compact ? "text-2xl" : "text-[120cqi]")}>7</span>
          </span>
        </div>
      </div>
      </div>
    </div>
  );
}
