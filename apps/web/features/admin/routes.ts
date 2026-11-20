export const adminRoutes = {
  seo: "/admin/configuracoes",
  overview: "/admin",
  games: "/admin/jogos",
  markets: "/admin/apostas",
  achievements: "/admin/conquistas",
  coupons: "/admin/cupons",
  users: "/admin/usuarios",
  pages: "/admin/paginas",
  media: "/admin/midia",
  menus: "/admin/menus",
} as const;
export type AdminSection = keyof typeof adminRoutes;
