import type { CSSProperties } from "react";
import Image from "next/image";
import { achievementMetrics, type Achievements } from "@croebet/shared";
import { Award, CalendarDays, Check, PlayingCards, Coins, Icon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";


const format = new Intl.NumberFormat("pt-BR");

export function AchievementsView({ data }: { data: Achievements }) {
  const total = data.items.reduce((sum, group) => sum + group.levels.length, 0);
  const unlocked = data.items.reduce((sum, group) => sum + group.levels.filter(level=>level.unlockedAt).length, 0);
  const stats = [
    { label: "Dias seguidos", value: data.stats.currentStreak, Icon: CalendarDays },
    { label: "Partidas jogadas", value: data.stats.games, Icon: PlayingCards },
    { label: "Croins perdidos", value: data.stats.lostCroins, Icon: Coins },
  ];

  return (
    <>
        <h1 className="sr-only">Conquistas</h1>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Card className="flex flex-col gap-4">
            <Award className="size-5 text-brand" aria-hidden="true" />
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {unlocked}
                <span className="text-base font-normal text-muted"> / {total}</span>
              </p>
              <p className="mt-1 text-xs text-muted">Conquistas liberadas</p>
            </div>
          </Card>
          {stats.map(({ label, value, Icon }) => (
            <Card key={label} className="flex flex-col gap-4">
              <Icon className="size-5 text-muted" aria-hidden="true" />
              <div>
                <p className="text-2xl font-bold tabular-nums">{format.format(value)}</p>
                <p className="mt-1 text-xs text-muted">{label}</p>
              </div>
            </Card>
          ))}
        </div>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.items.map(({ id, name: title, iconNode, imageUrl: defaultImageUrl, color, current, metric, levels }) => {
            const level = levels.filter(item=>item.unlockedAt).length;
            const earnedLevel = levels.filter(item=>item.unlockedAt).at(-1);
            const displayColor = earnedLevel?.color ?? color ?? "var(--color-brand)";
            const imageUrl = earnedLevel?.imageUrl || defaultImageUrl;
            const completed = level === levels.length;
            const milestone = levels.find(item=>!item.unlockedAt) ?? levels[levels.length-1];
            if (!milestone) return null;
            const progress = completed ? milestone.target : Math.min(current, milestone.target);
            const unit = achievementMetrics[metric].unit;

            return (
              <Card asChild key={id}>
                <li className="flex min-w-0 flex-col items-center text-center" style={{ "--achievement-color": displayColor } as CSSProperties}>
                  <div
                    className={cn(
                      "relative my-10 grid size-24 place-items-center",
                      !imageUrl && "rounded-full border-4 bg-primary-button inset-shadow-primary-button",
                      !imageUrl && (level > 0
                        ? "border-[color-mix(in_srgb,var(--achievement-color)_30%,transparent)] bg-[color-mix(in_srgb,var(--achievement-color)_15%,transparent)] text-[var(--achievement-color)]"
                        : "border-contrast/6 bg-contrast/6 text-muted"),
                    )}
                  >
                    {imageUrl ? <Image src={imageUrl} alt={`Emblema de ${title}`} width={500} height={500} unoptimized className="size-24 object-contain" /> : <div className="grid size-16 place-items-center rounded-full border border-current/20">
                      <Icon iconNode={iconNode} className="size-8" aria-hidden="true" />
                    </div>}
                    <span className="absolute -bottom-6 rounded-full bg-contrast/6 backdrop-blur-3xl px-3 py-2 text-xs font-semibold tabular-nums">
                      Nível {level}
                    </span>
                  </div>

                  <h2 className="mt-5 flex items-center gap-1.5 text-base font-semibold">
                    {title}
                    {completed && <Check className="size-4 text-[var(--achievement-color)]" aria-label="Concluída" />}
                  </h2>
                  <p className="mt-1 mb-6 flex-1 text-sm text-muted">
                    {milestone.description}
                  </p>

                  <div className="flex w-full items-center gap-3">
                    <div
                      role="progressbar"
                      aria-label={title}
                      aria-valuemin={0}
                      aria-valuemax={milestone.target}
                      aria-valuenow={progress}
                      aria-valuetext={`${format.format(progress)} de ${format.format(milestone.target)} ${unit}. Nível ${level} de ${levels.length}.`}
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-contrast/6"
                    >
                      <div
                        className="h-full rounded-full bg-[var(--achievement-color)]"
                        style={{ width: `${(progress / milestone.target) * 100}%` }}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-muted tabular-nums">
                      {format.format(progress)} / {format.format(milestone.target)}
                    </span>
                  </div>
                </li>
              </Card>
            );
          })}
        </ul>
        {!data.items.length && <EmptyState title="A estante de troféus está em montagem." description="As conquistas aparecem por aqui assim que forem publicadas." />}
    </>
  );
}
