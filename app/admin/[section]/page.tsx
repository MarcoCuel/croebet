import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminAccess } from "@/features/admin/admin-access";
import { adminRoutes } from "@/features/admin/routes";

const titles = {
  overview: "Visão geral",
  games: "Jogos",
  markets: "Apostas",
  users: "Usuários",
  pages: "Páginas",
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  const entry = Object.entries(adminRoutes).find(
    ([, href]) => href === `/admin/${section}`,
  );
  return entry ? { title: `${titles[entry[0] as keyof typeof titles]} · Admin · Croebet` } : {};
}

export default async function AdminSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === "sobre") redirect("/admin/paginas/sobre");
  const entry = Object.entries(adminRoutes).find(
    ([, href]) => href === `/admin/${section}`,
  );
  if (!entry) notFound();
  return <AdminAccess section={entry[0] as keyof typeof adminRoutes} />;
}
