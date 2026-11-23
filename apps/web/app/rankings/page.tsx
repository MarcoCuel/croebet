import type { Metadata } from "next";
import { rankingQuerySchema } from "@croebet/shared";
import { PageShell } from "@/components/layout/page-shell";
import { getRanking } from "@/features/rankings/server-rankings";
import { RankingCard } from "@/features/rankings/ranking-card";

export const metadata: Metadata = { title: "Rankings · Croebet" };
const categories = ["wins", "richest", "losers"] as const;
export default async function Rankings({ searchParams }: { searchParams: Promise<Record<string,string|string[]|undefined>> }) {
  const params = await searchParams;
  const periods = categories.map(category => category === "richest" || params[`${category}Period`] === "all" ? "all" as const : "month" as const);
  const pages = categories.map(category => {
    const parsed = rankingQuerySchema.shape.page.safeParse(params[`${category}Page`]);
    return parsed.success ? parsed.data : 1;
  });
  const results = await Promise.all(categories.map((category,index) => getRanking({ category, period: periods[index], page: pages[index] })));
  const href = (category: typeof categories[number], page: number, period?: "month" | "all") => {
    const query = new URLSearchParams();
    categories.forEach((key,index) => { if (key!=="richest") query.set(`${key}Period`, key===category && period ? period : periods[index]); });
    categories.forEach((key,index) => { const value = key===category ? page : pages[index]; if (value>1) query.set(`${key}Page`,String(value)); });
    return `/rankings?${query}`;
  };
  return <PageShell>
    <h1 className="sr-only">Rankings</h1>
    <div className="grid items-start gap-4 lg:grid-cols-3">{categories.map((category,index) => <RankingCard key={category} category={category} data={results[index]} page={pages[index]} period={periods[index]} monthHref={href(category,1,"month")} allHref={href(category,1,"all")} previous={href(category,pages[index]-1)} next={href(category,pages[index]+1)} retry={href(category,pages[index])} />)}</div>
  </PageShell>;
}
