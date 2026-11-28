"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ProfileActivity, ProfileActivityDay } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const levels = ["bg-contrast/6", "bg-brand/25", "bg-brand/50", "bg-brand/75", "bg-brand"];
const hoverLevels = ["hover:bg-contrast/6", "hover:bg-brand/25", "hover:bg-brand/50", "hover:bg-brand/75", "hover:bg-brand"];
const dateFormat = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const asDate = (date: string) => new Date(`${date}T12:00:00Z`);
const count = (day: ProfileActivityDay) => day.games + day.dailyBonuses + day.coupons;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
function description(day: ProfileActivityDay) {
  const events = [
    day.games > 0 ? plural(day.games, "partida", "partidas") : null,
    day.wins > 0 ? plural(day.wins, "vitória", "vitórias") : null,
    day.dailyBonuses > 0 ? plural(day.dailyBonuses, "bônus diário", "bônus diários") : null,
    day.coupons > 0 ? plural(day.coupons, "cupom", "cupons") : null,
  ].filter((event): event is string => event !== null);
  const details = events.length ? new Intl.ListFormat("pt-BR", { type: "conjunction" }).format(events) : "Nenhuma atividade";
  return `${dateFormat.format(asDate(day.date))}: ${details}.`;
}

export function ActivityHeatmap({ activity }: { activity: ProfileActivity }) {
  const scroll = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selected = activity.days.find(day => day.date === selectedDate);
  const [focused, setFocused] = useState(activity.days.length - 1);
  const offset = asDate(activity.days[0].date).getUTCDay();
  const weeks = Array.from({ length: Math.ceil((offset + activity.days.length) / 7) }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const index = week * 7 + weekday - offset;
      return { day: activity.days[index], index };
    }));

  useEffect(() => {
    if (scroll.current) scroll.current.scrollLeft = scroll.current.scrollWidth;
  }, []);

  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[event.key];
    if (delta === undefined && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? activity.days.length - 1 : Math.max(0, Math.min(activity.days.length - 1, index + (delta ?? 0)));
    setFocused(next);
    buttons.current.get(next)?.focus();
  }

  return (
    <Card className="mt-10 w-full min-w-0 text-left">
      <div ref={scroll} className="overflow-x-auto" tabIndex={0} role="region" aria-label="Calendário de atividades" data-lenis-prevent>
        <div className="flex flex-1 justify-between gap-0.5">
          {weeks.map((week, weekIndex) => {
            const monthDay = week.find(({ day }) => day?.date.endsWith("-01"))?.day ?? (weekIndex === 0 ? week.find(({ day }) => day)?.day : undefined);
            return (
              <div key={weekIndex} className="flex w-3.5 shrink-0 flex-col gap-1">
                {week.map(({ day, index }, weekday) => day ? (
                  <Tooltip key={day.date} open={selectedDate === day.date} onOpenChange={open => setSelectedDate(current => open ? day.date : current === day.date ? null : current)}>
                    <TooltipTrigger asChild>
                      <Button
                        ref={element => { if (element) buttons.current.set(index, element); else buttons.current.delete(index); }}
                        variant="ghost" size="icon-sm"
                        className={cn("backdrop-blur-none size-3.5 min-h-0 rounded-xs p-0 hover:brightness-125 focus-visible:border-foreground", levels[Math.min(4, count(day))], hoverLevels[Math.min(4, count(day))])}
                        aria-label={description(day)} aria-pressed={selected?.date === day.date}
                        tabIndex={focused === index ? 0 : -1}
                        onFocus={() => setFocused(index)} onClick={() => setSelectedDate(day.date)} onKeyDown={event => navigate(event, index)}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{description(day)}</TooltipContent>
                  </Tooltip>
                ) : <span key={weekday} className="size-3.5" aria-hidden="true" />)}
                <span className="overflow-visible whitespace-nowrap text-xs text-muted" aria-hidden="true">{monthDay ? monthFormat.format(asDate(monthDay.date)).replace(".", "") : ""}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
