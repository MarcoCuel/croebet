import { achievementDefinitionsSchema } from "@croebet/shared";
import { AdminAchievements } from "@/features/admin/admin-achievements";
import { AdminMedia } from "@/features/admin/admin-media";
import { catalogMarketsSchema } from "@croebet/shared";
import { AdminMarkets } from "@/features/admin/admin-markets";
import { gamesSchema } from "@croebet/shared";
import { AdminGames } from "@/features/admin/admin-games";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminAccess } from "@/features/admin/admin-access";
import { adminQuerySchema, adminUsersSchema, couponsQuerySchema, couponsSchema, pagesSchema } from "@croebet/shared";
import { AdminPages } from "@/features/admin/admin-pages";
import { menuAdminSchema } from "@croebet/shared";
import { AdminMenus } from "@/features/admin/admin-menus";
import { getManagement } from "@/features/admin/server-management";
import { AdminUsers } from "@/features/admin/admin-users";
import { AdminCoupons } from "@/features/admin/admin-coupons";
import { ManagementUnavailable } from "@/features/admin/management-shared";
import { adminRoutes } from "@/features/admin/routes";

import { seoSettingsSchema } from "@croebet/shared";
import { AdminSeo } from "@/features/admin/admin-seo";
import { bonusWindowSettingsSchema } from "@croebet/shared";
import { AdminExtras } from "@/features/admin/admin-extras";

const titles = {
  seo: "Configurações",
  overview: "Visão geral",
  games: "Jogos",
  markets: "Apostas",
  coupons: "Cupons",
  achievements: "Conquistas",
  users: "Usuários",
  pages: "Páginas",
  menus: "Menus",
  media: "Biblioteca de mídia",
  extras: "Extras",
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
  params, searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  const entry = Object.entries(adminRoutes).find(
    ([, href]) => href === `/admin/${section}`,
  );
  if (section === "seo") redirect(adminRoutes.seo);
  if (!entry) notFound();
  if (section === "midia") return <AdminAccess section="media" content={<AdminMedia />} />;
  if (section === "configuracoes") {
    const data = await getManagement("/admin/seo", seoSettingsSchema);
    return <AdminAccess section="seo" content={data ? <AdminSeo initial={data} /> : <ManagementUnavailable />} />;
  }
  if (section === "extras") {
    const data = await getManagement("/admin/bonus-windows", bonusWindowSettingsSchema);
    return <AdminAccess section="extras" content={data ? <AdminExtras initial={data} /> : <ManagementUnavailable />} />;
  }
  if (section === "apostas") {
    const data = await getManagement("/admin/markets", catalogMarketsSchema);
    return <AdminAccess section="markets" content={data ? <AdminMarkets markets={data.items} /> : <ManagementUnavailable />} />;
  }
  if (section === "conquistas") {
    const data = await getManagement("/admin/achievements", achievementDefinitionsSchema);
    return <AdminAccess section="achievements" content={data ? <AdminAchievements items={data.items} /> : <ManagementUnavailable />} />;
  }
  if (section === "jogos") {
    const data = await getManagement("/admin/games", gamesSchema);
    return <AdminAccess section="games" content={data ? <AdminGames games={data.items} /> : <ManagementUnavailable />} />;
  }
  if (section === "menus") {
    const data = await getManagement("/admin/menus", menuAdminSchema);
    return <AdminAccess section="menus" content={data ? <AdminMenus initial={data} /> : <ManagementUnavailable />} />;
  }
  if (section === "paginas") {
    const data = await getManagement("/admin/pages", pagesSchema);
    return <AdminAccess section="pages" content={data ? <AdminPages pages={data.items} /> : <ManagementUnavailable />} />;
  }
  if (section === "usuarios" || section === "cupons") {
    const search = await searchParams;
    const users = section === "usuarios";
    const parsed = (users ? adminQuerySchema : couponsQuerySchema).safeParse({ q: search.q, status: search.status, offset: search.offset });
    const query = parsed.success ? parsed.data : (users ? adminQuerySchema : couponsQuerySchema).parse({});
    const url = new URLSearchParams({ q: query.q, status: query.status, offset: String(query.offset) });
    if (users) {
      const data = await getManagement(`/admin/users?${url}`, adminUsersSchema);
      return <AdminAccess section="users" content={data ? <AdminUsers key={url.toString()} initial={data} query={query} /> : <ManagementUnavailable />} />;
    }
    const data = await getManagement(`/admin/coupons?${url}`, couponsSchema);
    return <AdminAccess section="coupons" content={data ? <AdminCoupons key={url.toString()} initial={data} query={query} /> : <ManagementUnavailable />} />;
  }
  return <AdminAccess section={entry[0] as keyof typeof adminRoutes} />;
}
