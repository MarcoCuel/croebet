import Link from "next/link";
import Image from "next/image";
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
  return <>{format.format(item.value)}<span className="ml-1 text-sm font-normal">{category === "wins" ? item.value === 1 ? "vitória" : "vitórias" : category === "losers" ? item.value === 1 ? "derrota" : "derrotas" : "Croins"}</span></>;
}
export function RankingCard({ data, category, page, previous, next, retry, period, monthHref, allHref }: { data: Ranking | null; category: Ranking["category"]; page: number; previous: string; next: string; retry: string; period: "month" | "all"; monthHref: string; allHref: string }) {
  const title = rankingTitles[category];
  const listItems = data?.items.slice(page === 1 ? 3 : 0) ?? [];
  return <Card asChild className="@container bg-contrast/6 p-0 pb-4 rounded-xl"><section aria-labelledby={`ranking-${category}`}>
    <div className="flex flex-wrap items-start justify-between gap-3 p-6">
      <Heading id={`ranking-${category}`} className="text-2xl font-medium leading-none @min-[26rem]:text-ranking-title">{title.split(" ").map(word => <span key={word} className="block">{word}</span>)}</Heading>
      {category !== "richest" && <nav aria-label={`Período de ${title}`} className="flex shrink-0 gap-2">{([['month','Este mês',monthHref],['all','Geral',allHref]] as const).map(([key,label,href]) => <Button key={key} asChild variant={key===period ? "secondary" : "ghost"} size="sm" className="min-h-9 px-2 text-sm font-medium @min-[26rem]:px-3"><Link href={href} aria-current={key===period ? "page" : undefined}>{label}</Link></Button>)}</nav>}
    </div>
    <div className="px-4">
      {!data ? <EmptyState title="O placar ficou indisponível." description="Tente novamente para consultar a classificação." action={<Button asChild variant="secondary"><Link href={retry}>Tentar novamente</Link></Button>} /> : <>
        {!data.items.length ? <EmptyState title={page > 1 ? "Você chegou ao fim do ranking." : empty[category][0]} description={page > 1 ? "Os outros colocados ficaram nas páginas anteriores." : empty[category][1]} icon={category === "losers" ? <TrendingDown className="size-6" /> : <Trophy className="size-6" />} /> : <>
          {page === 1 && <ol role="list" aria-label={`Pódio de ${title}`} className="-mx-2 grid grid-cols-3 gap-1 items-end py-4 px-2">
            {data.items.slice(0,3).map((item,index) => <li key={item.userId} value={item.position} className={cn("min-w-0 text-center", index === 0 ? "col-start-2 row-start-1" : index === 1 ? "col-start-1 row-start-1" : "col-start-3 row-start-1")}>
              <Link href={`/perfil/${encodeURIComponent(item.username)}`} aria-label={`Posição ${item.position} ${item.displayName}`} aria-describedby={`ranking-value-${category}-${item.userId}`} className="flex min-w-0 flex-col items-center gap-4 hover:text-brand">
                <span className="relative shrink-0">
                  <Avatar className={cn("inset-shadow-primary-button",index === 0 ? "size-14" : "size-12")} aria-hidden="true"><AccountAvatarImage name={item.username} src={item.avatarUrl} /><AvatarFallback className="bg-contrast/6 text-sm">{item.displayName.slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
                  {index === 0 && <Image src="/host.svg" width={25} height={24} className="absolute -top-3 -left-1 h-6 w-auto" alt="" aria-hidden="true" />}
                </span>
                <div className="w-full min-w-0 text-sm leading-none">
                  <span className="block truncate font-medium" title={item.displayName}>{item.displayName}{item.userId===data.own?.userId && <span className="ml-1 text-xs text-brand">Você</span>}</span>
                  <span id={`ranking-value-${category}-${item.userId}`} className="mt-2 block text-muted tabular-nums"><Amount item={item} category={category} /></span>
                </div>
                <span aria-hidden="true" className={cn("grid w-full place-items-center rounded-xl border border-white/6 font-medium leading-none text-white tabular-nums inset-shadow-primary-button",index === 0 ? "h-20 bg-brand" : index === 1 ? "h-14 bg-contrast/16" : "h-[2.5rem] bg-contrast/10")}>{item.position} lugar</span>
              </Link>
            </li>)}
          </ol>}
          {listItems.length > 0 && <ol role="list" aria-label={`Classificação de ${title}`} start={page === 1 ? 4 : (page-1)*10+1} className="overflow-hidden rounded-xl bg-contrast/6 divide-y divide-contrast/6">
            {listItems.map(item => <li key={item.userId} value={item.position} className="flex items-center gap-3 px-4 py-2 @min-[26rem]:gap-4">
              <span className="min-w-2.5 shrink-0 text-center text-sm font-medium text-muted tabular-nums" aria-hidden="true">{item.position}</span>
              <Link href={`/perfil/${encodeURIComponent(item.username)}`} className="flex min-w-0 flex-1 items-center gap-3 hover:text-brand @min-[26rem]:gap-4"><Avatar className="size-10 shrink-0 inset-shadow-primary-button" aria-hidden="true"><AccountAvatarImage name={item.username} src={item.avatarUrl} /><AvatarFallback className="bg-contrast/6 text-xs">{item.displayName.slice(0,2).toUpperCase()}</AvatarFallback></Avatar><span className="min-w-0 flex-1 truncate text-sm font-medium" title={item.displayName}>{item.displayName}{item.userId===data.own?.userId && <span className="ml-2 text-xs text-brand">Você</span>}</span></Link>
              <span className="shrink-0 text-right text-sm tabular-nums"><Amount item={item} category={category} /></span>
            </li>)}
          </ol>}
        </>}
        {data.own && !data.items.some(item => item.userId===data.own?.userId) && <p className="mt-4 border-t border-contrast/6 pt-4 text-sm text-muted">Sua posição: <span className="font-semibold text-foreground">{data.own.position}º</span><span className="float-right"><Amount item={data.own} category={category} /></span></p>}
        {(page>1 || data.hasMore) && <nav aria-label={`Paginação de ${title}`} className="mt-4 flex justify-between gap-2 border-t border-contrast/6 pt-4">{page>1 ? <Button asChild variant="secondary" size="sm"><Link href={previous}>Anterior</Link></Button> : <span />}{data.hasMore && <Button asChild variant="secondary" size="sm"><Link href={next}>Próxima</Link></Button>}</nav>}
      </>}
    </div>
  </section></Card>;
}
