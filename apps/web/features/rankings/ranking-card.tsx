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

export const rankingTitles = { wins: "Vitórias", richest: "Mais ricos", losers: "Maiores perdedores" } as const;
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
        {page === 1 && <ol role="list" aria-label={`Pódio de ${title}`} className="mx-auto mt-6 grid max-w-sm grid-cols-3 items-end gap-1 pb-6">
          {data.items.slice(0,3).map((item, index) => <li key={item.userId} value={item.position} className={cn("min-w-0 text-center", index === 0 ? "order-2 col-start-2" : index === 1 ? "order-1 col-start-1 row-start-1" : "order-3 col-start-3 row-start-1")}>
            <Link href={`/perfil/${encodeURIComponent(item.username)}`} aria-label={`Posição ${item.position} ${item.displayName}`} className="group flex w-full min-w-0 flex-col items-center hover:text-brand">
              <Avatar className="size-12" aria-hidden="true"><AccountAvatarImage name={item.username} src={item.avatarUrl} /><AvatarFallback className="text-base">{item.displayName.slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
              <span className="mt-2 w-full truncate text-xs font-semibold" title={item.displayName}>{item.displayName}</span>
              <span className="mt-1 w-full text-xs text-muted tabular-nums [&_span]:ml-0 [&_span]:block"><Amount item={item} category={category} /></span>
              {item.userId===data.own?.userId && <span className="mt-1 text-xs text-brand">Você</span>}
              <span aria-hidden="true" className={cn("mt-3 flex w-full justify-center rounded-t-panel bg-linear-to-b from-brand/15 to-brand/5 pt-4 text-4xl font-medium leading-none text-foreground/80 transition-colors group-hover:from-brand/25", index === 0 ? "h-32 from-brand/25 text-5xl" : index === 1 ? "h-24" : "h-20")}>{item.position}</span>
            </Link>
          </li>)}
        </ol>}
        {data.items.length > (page === 1 ? 3 : 0) && <ol role="list" aria-label={`Classificação de ${title}`} start={page === 1 ? 4 : (page-1)*10+1} className="divide-y divide-contrast/6 border-t border-contrast/6">
          {data.items.slice(page === 1 ? 3 : 0).map(item => <li key={item.userId} value={item.position} className="flex items-center gap-3 py-4 last:pb-0">
            <span className="w-5 shrink-0 text-center text-sm font-semibold text-muted tabular-nums" aria-hidden="true">{item.position}</span>
            <Link href={`/perfil/${encodeURIComponent(item.username)}`} className="flex min-w-0 flex-1 items-center gap-3 hover:text-brand"><Avatar className="size-10 shrink-0" aria-hidden="true"><AccountAvatarImage name={item.username} src={item.avatarUrl} /><AvatarFallback className="text-xs">{item.displayName.slice(0,2).toUpperCase()}</AvatarFallback></Avatar><span className="min-w-0 flex-1 truncate text-sm font-medium" title={item.displayName}>{item.displayName}{item.userId===data.own?.userId && <span className="ml-2 text-xs text-brand">Você</span>}</span></Link>
            <span className="shrink-0 text-right text-sm font-semibold tabular-nums"><Amount item={item} category={category} /></span>
          </li>)}
        </ol>}
      </>}
      {data.own && !data.items.some(item => item.userId===data.own?.userId) && <p className="mt-4 border-t border-contrast/6 pt-4 text-sm text-muted">Sua posição: <span className="font-semibold text-foreground">{data.own.position}º</span><span className="float-right"><Amount item={data.own} category={category} /></span></p>}
      {(page>1 || data.hasMore) && <nav aria-label={`Paginação de ${title}`} className="mt-4 flex justify-between gap-2 border-t border-contrast/6 pt-4">{page>1 ? <Button asChild variant="secondary" size="sm"><Link href={previous}>Anterior</Link></Button> : <span />}{data.hasMore && <Button asChild variant="secondary" size="sm"><Link href={next}>Próxima</Link></Button>}</nav>}
    </>}
  </section></Card>;
}
