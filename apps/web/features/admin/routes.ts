export const adminRoutes = {
  overview: "/admin",
  games: "/admin/jogos",
  markets: "/admin/apostas",
  coupons: "/admin/cupons",
  users: "/admin/usuarios",
  pages: "/admin/paginas",
} as const;
export type AdminSection = keyof typeof adminRoutes;
