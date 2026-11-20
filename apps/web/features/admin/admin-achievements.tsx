"use client";
import Link from "next/link";
import { useState } from "react";
import { achievementMetrics, type AchievementDefinition } from "@croebet/shared";
import { AdminListHeader, AdminFilterCount } from "@/features/admin/admin-list-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/search-input";

export function AdminAchievements({ items }: { items: AchievementDefinition[] }) {
  const [search,setSearch] = useState("");
  const [status,setStatus] = useState("all");
  const normalize = (text: string)=>text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
  const matches = (item: AchievementDefinition, filter: string)=>filter==="all" || item.active===(filter==="active");
  const visible = items.filter(item=>matches(item,status)&&normalize(item.name).includes(normalize(search.trim())));
  return <div className="grid min-w-0 gap-4">
    <h1 className="sr-only">Conquistas</h1>
    <AdminListHeader filterLabel="Status das conquistas" create={{href:"/admin/conquistas/nova",label:"Criar conquista"}} filters={<>{[["all","Todas"],["active","Ativas"],["inactive","Inativas"]].map(([value,label])=><Button key={value} size="sm" variant={status===value?"secondary":"ghost"} aria-pressed={status===value} onClick={()=>setStatus(value)}>{label}{status===value&&<AdminFilterCount count={items.filter(item=>matches(item,value)).length}/>}</Button>)}</>} search={<SearchInput aria-label="Buscar conquistas no admin" placeholder="Buscar conquistas…" value={search} onChange={event=>setSearch(event.target.value)}/>}/>
    <Card className="overflow-hidden p-0 sm:p-0">{visible.length?<ul aria-label="Conquistas" className="divide-y divide-contrast/6">{visible.map(item=><li key={item.id}><Link href={`/admin/conquistas/${item.id}`} className="flex flex-wrap items-center gap-4 p-5 transition-colors hover:bg-contrast/4 focus-visible:outline-none focus-visible:bg-contrast/4"><div className="min-w-0 flex-1"><span className="block font-semibold wrap-anywhere">{item.name}</span><span className="mt-1 block text-xs text-muted">{achievementMetrics[item.metric].label} · {item.levels.length} níveis</span></div><Badge variant={item.active?"default":"secondary"}>{item.active?"Ativa":"Inativa"}</Badge></Link></li>)}</ul>:<EmptyState title="Nenhuma conquista encontrada."/>}</Card>
  </div>;
}
