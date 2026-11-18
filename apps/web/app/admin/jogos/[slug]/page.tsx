import type { Metadata } from "next";
import { AdminAccess } from "@/features/admin/admin-access";
import { games } from "@/features/games/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const game = games.find((entry) => entry.slug === slug);
  return { title: `${game ? `Editar ${game.name}` : "Editar jogo"} · Admin · Croebet` };
}

export default async function EditGamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <AdminAccess section="games" gameSlug={slug} />;
}
