export const adminRoutes = {
  seo: "/admin/seo",
  overview: "/admin",
  games: "/admin/jogos",
  markets: "/admin/apostas",
  coupons: "/admin/cupons",
  users: "/admin/usuarios",
  pages: "/admin/paginas",
  menus: "/admin/menus",
} as const;
export type AdminSection = keyof typeof adminRoutes;
