import { notFound } from "next/navigation";
import { resourceIdSchema, gameReplaySchema } from "@croebet/shared";
import { AdminAccess } from "@/features/admin/admin-access";
import { getManagement } from "@/features/admin/server-management";
import { ManagementUnavailable } from "@/features/admin/management-shared";
import { AdminMatchReplay } from "@/features/admin/admin-match-replay";
export const metadata = { title: "Histórico da partida · Admin · Croebet" };
export default async function MatchReplayPage({ params }: { params: Promise<{id:string;matchId:string}> }) {
  const {id,matchId}=await params;
  if(!resourceIdSchema.safeParse(id).success||!resourceIdSchema.safeParse(matchId).success)notFound();
  const replay=await getManagement(`/admin/games/${id}/matches/${matchId}?limit=100`,gameReplaySchema);
  return <AdminAccess section="games" content={replay?<AdminMatchReplay initial={replay} />:<ManagementUnavailable />} />;
}
