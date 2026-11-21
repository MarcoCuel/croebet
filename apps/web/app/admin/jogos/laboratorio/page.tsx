import type { Metadata } from "next";
import { AdminAccess } from "@/features/admin/admin-access";
import { GameLaboratory } from "@/features/games/laboratory/laboratory";

export const metadata: Metadata = { title: "Laboratório de jogos · Admin · Croebet" };
export default function LaboratoryPage() {
  return <AdminAccess section="games" content={<GameLaboratory />} />;
}
