import { notFound } from "next/navigation";
import { AdminAccess } from "@/features/admin/admin-access";
import { gameSchema, resourceIdSchema } from "@croebet/shared";
import { getManagement } from "@/features/admin/server-management";
import { AdminGameEditor } from "@/features/admin/admin-game-editor";
import { ManagementUnavailable } from "@/features/admin/management-shared";

export const metadata = { title: "Editar jogo · Admin · Croebet" };
export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!resourceIdSchema.safeParse(id).success) notFound();
  const game = await getManagement(`/admin/games/${encodeURIComponent(id)}`, gameSchema);
  return <AdminAccess section="games" content={game ? <AdminGameEditor key={`${game.id}:${game.version}`} game={game} /> : <ManagementUnavailable />} />;
}
