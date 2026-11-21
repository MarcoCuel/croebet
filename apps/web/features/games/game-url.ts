export function gameUrl(slug: string, options: { code?: string | null; development?: boolean; invite?: boolean } = {}) {
  const params = new URLSearchParams();
  if (options.code) params.set("partida", options.code);
  if (options.development) params.set("teste", "1");
  if (options.invite) params.set("convidar", "1");
  const query = params.toString();
  return `/jogos/${slug}${query ? `?${query}` : ""}`;
}
