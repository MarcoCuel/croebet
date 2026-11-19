"use client";

import { useEffect, useRef, useState } from "react";
import { lucideIconNames, type IconName } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import LucideIcon from "@/components/ui/lucide-icon";

export default function IconPickerGallery({ value, onValueChange }: {
  value?: IconName | null;
  onValueChange: (value: IconName | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(60);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { searchRef.current?.focus(); }, []);
  const words = query.trim().toLowerCase().split(/[\s-]+/u);
  const matches = lucideIconNames.filter(name => words.every(word => name.includes(word)));
  return <>
    <SearchInput ref={searchRef} aria-label="Buscar ícones" placeholder="Buscar ícones..." value={query} onChange={event => {
      setQuery(event.target.value);
      setLimit(60);
      scrollRef.current?.scrollTo({ top: 0 });
    }} />
    <div ref={scrollRef} className="h-72 overflow-y-auto overscroll-contain" data-lenis-prevent>
      <div role="group" aria-label="Ícones Lucide" className="grid grid-cols-5 gap-2">
        {matches.slice(0, limit).map(name => <Button key={name} variant="secondary" className="h-12 px-0 aria-pressed:bg-contrast/16 aria-pressed:text-foreground" aria-label={`Selecionar ${name}`} title={name} aria-pressed={value === name} onClick={() => onValueChange(name)}>
          <LucideIcon name={name} className="size-5" />
        </Button>)}
      </div>
      {!matches.length && <p role="status" className="py-6 text-center text-sm text-muted">Nenhum ícone encontrado.</p>}
      {matches.length > limit && <Button variant="ghost" className="mt-3 w-full" onClick={() => setLimit(limit => limit + 60)}>Mostrar mais ícones</Button>}
    </div>
    <Button variant="secondary" className="w-full" disabled={!value} onClick={() => onValueChange(null)}>Remover</Button>
  </>;
}
