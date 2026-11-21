import type { Metadata } from "next";
import { AdminAccess } from "@/features/admin/admin-access";
import { LoveCardCatalog } from "@/features/games/love-letter/card-catalog";

export const metadata: Metadata = { title: "Cartas do Love Letter · Croebet" };
export default function LoveCardsPage() {
  return <AdminAccess section="games" content={<LoveCardCatalog />} />;
}
