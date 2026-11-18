export const adminRoutes = {
  overview: "/admin",
  games: "/admin/jogos",
  markets: "/admin/apostas",
  about: "/admin/sobre",
  balance: "/admin/saldo",
} as const;
export type AdminSection = keyof typeof adminRoutes;
