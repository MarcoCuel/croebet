import Link from "next/link";
import { Trophy, TrendingDown } from "lucide-react";
import type { Ranking } from "@croebet/shared";
import { Heading } from "@/components/shared/heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AccountAvatarImage } from "@/features/auth/account-avatar-image";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";

export const rankingTitles = { wins: "Mais vitoriosos", richest: "Mais ricos", losers: "Maiores perdedores" } as const;
const empty = {
  wins: ["O trono está vago.", "Todo mundo tem potencial. Falta alguém ganhar uma partida."],
  richest: ["A elite financeira ainda não chegou.", "Por enquanto, o patrimônio da comunidade é a amizade."],
  losers: ["Ninguém perdeu ainda. Suspeito.", "Por enquanto, todo mundo pode dizer que sabe o que está fazendo."],
};
const format = new Intl.NumberFormat("pt-BR");
function Amount({ item, category }: { item: Ranking["items"][number]; category: Ranking["category"] }) {
  return <>{format.format(item.value)}<span className="ml-1 text-xs font-normal text-muted">{category === "wins" ? item.value === 1 ? "vitória" : "vitórias" : category === "losers" ? item.value === 1 ? "derrota" : "derrotas" : "Croins"}</span></>;
}
export function RankingCard({ data, category, page, previous, next, retry, period, monthHref, allHref }: { data: Ranking | null; category: Ranking["category"]; page: number; previous: string; next: string; retry: string; period: "month" | "all"; monthHref: string; allHref: string }) {
  const title = rankingTitles[category];
  return <Card asChild><section aria-labelledby={`ranking-${category}`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Heading id={`ranking-${category}`}>{title}</Heading>
      {category !== "richest" && <nav aria-label={`Período de ${title}`} className="flex gap-1">{([['month','Este mês',monthHref],['all','Geral',allHref]] as const).map(([key,label,href]) => <Button key={key} asChild variant={key===period ? "secondary" : "ghost"} size="sm"><Link href={href} aria-current={key===period ? "page" : undefined}>{label}</Link></Button>)}</nav>}
    </div>
    {!data ? <EmptyState title="O placar ficou indisponível." description="Tente novamente para consultar a classificação." action={<Button asChild variant="secondary"><Link href={retry}>Tentar novamente</Link></Button>} /> : <>
      {!data.items.length ? <EmptyState title={page > 1 ? "Você chegou ao fim do ranking." : empty[category][0]} description={page > 1 ? "Os outros colocados ficaram nas páginas anteriores." : empty[category][1]} icon={category === "losers" ? <TrendingDown className="size-6" /> : <Trophy className="size-6" />} /> : <>
        <ol role="list" aria-label={`Classificação de ${title}`} start={(page-1)*10+1} className="mt-4 divide-y divide-contrast/6">
          {data.items.map(item => <li key={item.userId} value={item.position} className="flex items-center gap-4 py-4 last:pb-0">
            <span className={cn("w-5 shrink-0 text-center text-sm font-semibold tabular-nums", item.position === 1 ? "text-flip-amber" : item.position === 2 ? "text-flip-silver" : item.position === 3 ? "text-flip-orange" : "text-muted")} aria-hidden="true">{item.position}</span>
            <Link href={`/perfil/${encodeURIComponent(item.username)}`} className="flex min-w-0 flex-1 items-center gap-4 hover:text-brand"><Avatar className="size-10 shrink-0" aria-hidden="true"><AccountAvatarImage name={item.username} src={item.avatarUrl} /><AvatarFallback className="text-xs">{item.displayName.slice(0,2).toUpperCase()}</AvatarFallback></Avatar><span className="min-w-0 flex-1 truncate text-sm font-medium" title={item.displayName}>{item.displayName}{item.userId===data.own?.userId && <span className="ml-2 text-xs text-brand">Você</span>}</span></Link>
            <span className="shrink-0 text-right text-sm font-semibold tabular-nums"><Amount item={item} category={category} /></span>
          </li>)}
        </ol>
      </>}
      {data.own && !data.items.some(item => item.userId===data.own?.userId) && <p className="mt-4 border-t border-contrast/6 pt-4 text-sm text-muted">Sua posição: <span className="font-semibold text-foreground">{data.own.position}º</span><span className="float-right"><Amount item={data.own} category={category} /></span></p>}
      {(page>1 || data.hasMore) && <nav aria-label={`Paginação de ${title}`} className="mt-4 flex justify-between gap-2 border-t border-contrast/6 pt-4">{page>1 ? <Button asChild variant="secondary" size="sm"><Link href={previous}>Anterior</Link></Button> : <span />}{data.hasMore && <Button asChild variant="secondary" size="sm"><Link href={next}>Próxima</Link></Button>}</nav>}
    </>}
  </section></Card>;
}
