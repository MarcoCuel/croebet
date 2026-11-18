import type { Metadata } from "next";
import { Award, Check, LockKeyhole } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { Heading } from "@/components/shared/heading";
import { Card } from "@/components/ui/card";
import {
  achievementGroups,
  achievementStats,
} from "@/features/achievements/catalog";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Conquistas | Croebet" };

const format = new Intl.NumberFormat("pt-BR");

export default function Achievements() {
  const achievements = achievementGroups.flatMap((group) =>
    group.achievements.map((achievement) => ({
      ...achievement,
      current: group.current,
    })),
  );
  const unlocked = achievements.filter(
    ({ current, target }) => current >= target,
  ).length;

  return (
    <PageShell>
      <h1 className="sr-only">Conquistas</h1>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="flex flex-col gap-4">
          <Award className="size-5 text-brand" aria-hidden="true" />
          <div>
            <p className="text-2xl font-bold tabular-nums">
              {unlocked}
              <span className="text-base font-normal text-muted">
                {" "}
                / {achievements.length}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted">Conquistas liberadas</p>
          </div>
        </Card>
        {achievementStats.map(({ label, value, Icon }) => (
          <Card key={label} className="flex flex-col gap-4">
            <Icon className="size-5 text-muted" aria-hidden="true" />
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {format.format(value)}
              </p>
              <p className="mt-1 text-xs text-muted">{label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-10 grid gap-8">
        {achievementGroups.map(
          ({ id, title, description, Icon, current, unit, achievements }) => (
            <section key={id} aria-labelledby={`achievements-${id}`}>
              <Heading id={`achievements-${id}`}>{title}</Heading>
              <p className="mt-1 text-sm text-muted">{description}</p>
              <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {achievements.map((achievement) => {
                  const completed = current >= achievement.target;
                  const progress = Math.min(current, achievement.target);
                  return (
                    <Card asChild key={achievement.title}>
                      <li className="flex flex-col">
                        <div className="flex items-center justify-between gap-3">
                          <div
                            className={cn(
                              "grid size-14 shrink-0 place-items-center rounded-panel",
                              completed
                                ? "bg-brand/15 text-brand"
                                : "bg-control text-muted",
                            )}
                          >
                            <Icon className="size-7" aria-hidden="true" />
                          </div>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 text-xs",
                              completed ? "text-brand" : "text-muted",
                            )}
                          >
                            {completed ? (
                              <Check className="size-3.5" aria-hidden="true" />
                            ) : (
                              <LockKeyhole
                                className="size-3.5"
                                aria-hidden="true"
                              />
                            )}
                            {completed ? "Conquistado" : "Em progresso"}
                          </span>
                        </div>
                        <h3 className="mt-5 text-base font-semibold">
                          {achievement.title}
                        </h3>
                        <p className="mt-1 mb-5 flex-1 text-sm text-muted">
                          {achievement.description}
                        </p>
                        <div className="flex items-center justify-between gap-2 text-xs text-muted tabular-nums">
                          <span>
                            {format.format(progress)} /{" "}
                            {format.format(achievement.target)} {unit}
                          </span>
                          <span>
                            {Math.floor((progress / achievement.target) * 100)}%
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-label={achievement.title}
                          aria-valuemin={0}
                          aria-valuemax={achievement.target}
                          aria-valuenow={progress}
                          aria-valuetext={`${format.format(progress)} de ${format.format(achievement.target)} ${unit}`}
                          className="mt-2 h-1.5 overflow-hidden rounded-full bg-control"
                        >
                          <div
                            className={cn(
                              "h-full rounded-full",
                              completed ? "bg-brand" : "bg-brand/50",
                            )}
                            style={{
                              width: `${(progress / achievement.target) * 100}%`,
                            }}
                          />
                        </div>
                      </li>
                    </Card>
                  );
                })}
              </ul>
            </section>
          ),
        )}
      </div>
    </PageShell>
  );
}
