import { AdminAccess } from "@/features/admin/admin-access";
import { gameSchema } from "@croebet/shared";
import { getManagement } from "@/features/admin/server-management";
import { AdminGameEditor } from "@/features/admin/admin-game-editor";
import { ManagementUnavailable } from "@/features/admin/management-shared";

export const metadata = { title: "Editar jogo · Admin · Croebet" };
export default async function EditGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const game = await getManagement(`/admin/games/${encodeURIComponent(slug)}`, gameSchema);
  return <AdminAccess section="games" content={game ? <AdminGameEditor key={`${game.slug}:${game.version}`} game={game} /> : <ManagementUnavailable />} />;
}
