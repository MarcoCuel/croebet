"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { GameCover } from "@/features/games/game-cover";
import { useSiteConfig } from "@/features/admin/site-config";

export function AdminGameEditor({ slug }: { slug: string }) {
  const { config, save } = useSiteConfig();
  const router = useRouter();
  const game = config.games.find((g) => g.slug === slug);
  if (!game) notFound();
  return (
    <div>
      <h1 className="mb-5 text-xl font-semibold">Editar jogo</h1>
      <Card>
        <form
          key={slug}
          className="grid items-start gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const name = String(form.get("name") ?? "").trim();
            if (!name) {
              const input = event.currentTarget.elements.namedItem(
                "name",
              ) as HTMLInputElement;
              input.setCustomValidity("Informe o nome do jogo.");
              input.reportValidity();
              return;
            }
            if (
              await save({
                ...config,
                games: config.games.map((g) =>
                  g.slug === slug
                    ? {
                        ...g,
                        name,
                        coverTitle: [name],
                        enabled: form.get("enabled") === "on",
                      }
                    : g,
                ),
              })
            )
              router.push("/admin/jogos");
          }}
        >
          <GameCover slug={game.slug} name={game.name} />
          <div className="grid gap-5">
            <Field>
              Nome do jogo
              <Input
                name="name"
                defaultValue={game.name}
                required
                maxLength={100}
                onInput={(event) => event.currentTarget.setCustomValidity("")}
              />
            </Field>
            <Field className="flex items-center justify-between">
              Jogo ativo
              <Switch name="enabled" defaultChecked={game.enabled} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Salvar jogo</Button>
              <Button asChild variant="secondary">
                <Link href="/admin/jogos">Cancelar</Link>
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
