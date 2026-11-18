import type { Metadata } from "next";
import { Award, CalendarDays, Check } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { achievementGroups } from "@/features/achievements/catalog";
import { AchievementsAccess } from "@/features/achievements/achievements-access";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Conquistas · Croebet" };

const format = new Intl.NumberFormat("pt-BR");

export default function Achievements() {
  const total = achievementGroups.reduce((sum, group) => sum + group.milestones.length, 0);
  const unlocked = achievementGroups.reduce(
    (sum, group) => sum + group.milestones.filter(({ target }) => group.current >= target).length,
    0,
  );
  const stats = achievementGroups
    .filter(({ id }) => id !== "palpites")
    .map(({ id, current, Icon }) => ({
      label: id === "presenca" ? "Dias seguidos" : id === "partidas" ? "Partidas jogadas" : "Croins perdidos",
      value: current,
      Icon: id === "presenca" ? CalendarDays : Icon,
    }));

  return (
    <AchievementsAccess>
      <PageShell>
        <h1 className="sr-only">Conquistas</h1>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {achievementGroups.map(({ id, title, Icon, current, unit, milestones }) => {
            const level = milestones.filter(({ target }) => current >= target).length;
            const completed = level === milestones.length;
            const milestone = milestones[level] ?? milestones[milestones.length - 1];
            const progress = Math.min(current, milestone.target);

            return (
              <Card asChild key={id}>
                <li className="flex min-w-0 flex-col items-center text-center">
                  <div
                    className={cn(
                      "relative my-3 grid size-24 place-items-center rounded-full border-4 bg-primary-button inset-shadow-primary-button",
                      level > 0
                        ? "border-brand/30 bg-brand/15 text-brand"
                        : "border-border bg-control text-muted",
                    )}
                  >
                    <div className="grid size-16 place-items-center rounded-full border border-current/20">
                      <Icon className="size-8" aria-hidden="true" />
                    </div>
                    <span className="absolute -bottom-2 rounded-full bg-surface px-2 text-xs font-semibold tabular-nums">
                      <span className="sr-only">Nível </span>
                      {level}/{milestones.length}
                    </span>
                  </div>

                  <h2 className="mt-5 flex items-center gap-1.5 text-base font-semibold">
                    {title}
                    {completed && <Check className="size-4 text-brand" aria-label="Concluída" />}
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
                      aria-valuetext={`${format.format(progress)} de ${format.format(milestone.target)} ${unit}. Nível ${level} de ${milestones.length}.`}
                      className="h-1.5 flex-1 overflow-hidden rounded-full bg-control"
                    >
                      <div
                        className="h-full rounded-full bg-brand"
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
      </PageShell>
    </AchievementsAccess>
  );
}
