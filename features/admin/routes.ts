export const adminRoutes = {
  overview: "/admin",
  games: "/admin/jogos",
  markets: "/admin/apostas",
  users: "/admin/usuarios",
  pages: "/admin/paginas",
} as const;
export type AdminSection = keyof typeof adminRoutes;
