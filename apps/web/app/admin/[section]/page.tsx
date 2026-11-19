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

const titles = {
  overview: "Visão geral",
  games: "Jogos",
  markets: "Apostas",
  coupons: "Cupons",
  users: "Usuários",
  pages: "Páginas",
  menus: "Menus",
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
  if (section === "sobre") redirect("/admin/paginas/sobre");
  const entry = Object.entries(adminRoutes).find(
    ([, href]) => href === `/admin/${section}`,
  );
  if (!entry) notFound();
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
