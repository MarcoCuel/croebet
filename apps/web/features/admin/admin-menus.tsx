"use client";
import { randomUUID } from "@/lib/uuid";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, ChevronDown, Trash2 } from "lucide-react";
import { fixedMenuPages, menuSchema, menuWriteSchema, type MenuAdmin, type MenuItem, type MenuLocation, type MenuRecord } from "@croebet/shared";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { IconPicker } from "@/components/ui/icon-picker";
import { managementRequest } from "@/features/admin/management-api";

export function AdminMenus({ initial }: { initial: MenuAdmin }) {
  const router = useRouter();
  const [location, setLocation] = useState<MenuLocation>("main");
  const [menus, setMenus] = useState(initial.menus);
  const [saved, setSaved] = useState(initial.menus);
  const [fixed, setFixed] = useState<keyof typeof fixedMenuPages>("home");
  const [pageId, setPageId] = useState(initial.pages[0]?.id ?? "");
  const [customLabel, setCustomLabel] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const current = menus.find(menu => menu.location === location)!;
  const dirty = JSON.stringify(current) !== JSON.stringify(saved.find(menu => menu.location === location));
  function update(items: MenuItem[]) {
    setMenus(menus => menus.map(menu => menu.location === location ? { ...menu, items } : menu));
  }
  function add(item: MenuItem) {
    const result = menuWriteSchema.safeParse({ version: current.version, items: [...current.items, item] });
    if (!result.success) return void toast.error(result.error.issues[0].message);
    update(result.data.items);
  }
  function move(index: number, offset: number) {
    const items = [...current.items];
    [items[index], items[index + offset]] = [items[index + offset], items[index]];
    update(items);
  }
  const replace = (id: string, change: (item: MenuItem) => MenuItem) => update(current.items.map(item => item.id === id ? change(item) : item));
  return <div className="grid items-start gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
    <aside className="xl:sticky xl:top-[calc(var(--header-height)+1rem)]" aria-label="Adicionar itens ao menu">
      <Card className="divide-y divide-contrast/6 overflow-hidden p-0 sm:p-0 xl:max-h-[calc(100dvh-var(--header-height)-2rem)] xl:overflow-y-auto" data-lenis-prevent>
        <div role="group" aria-label="Páginas fixas" className="grid gap-4 p-5 sm:p-6">
          <Field>Página fixa<Select aria-label="Página fixa" value={fixed} onChange={event => setFixed(event.target.value as keyof typeof fixedMenuPages)} disabled={saving}>
            {Object.entries(fixedMenuPages).map(([key, value]) => <option key={key} value={key}>{value.label}{value.disabled ? " — Em breve" : ""}</option>)}
          </Select></Field>
          <Button type="button" variant="secondary" size="sm" className="justify-self-start" disabled={saving || current.items.length >= 50} onClick={() => add({ id: randomUUID(), type: "fixed", target: fixed, label: fixedMenuPages[fixed].label, newTab: false })}>Adicionar</Button>
        </div>
        <div role="group" aria-label="Páginas criadas" className="grid gap-4 p-5 sm:p-6">
          {initial.pages.length ? <>
            <Field>Página criada<Select aria-label="Página criada" value={pageId} onChange={event => setPageId(event.target.value)} disabled={saving}>
              {initial.pages.map(page => <option key={page.id} value={page.id}>{page.title}{page.published ? "" : " — Rascunho"}</option>)}
            </Select></Field>
            <Button type="button" variant="secondary" size="sm" className="justify-self-start" disabled={saving || !pageId || current.items.length >= 50} onClick={() => {
              const page = initial.pages.find(page => page.id === pageId);
              if (page) add({ id: randomUUID(), type: "page", pageId, label: page.title, newTab: false });
            }}>Adicionar</Button>
          </> : <p className="text-sm text-muted">Nenhuma página criada ainda.</p>}
        </div>
        <div role="group" aria-label="Link personalizado" className="grid gap-4 p-5 sm:p-6">
          <Field>Rótulo do link<Input value={customLabel} maxLength={80} disabled={saving} onChange={event => setCustomLabel(event.target.value)} /></Field>
          <Field>URL do link<Input value={customUrl} maxLength={2000} disabled={saving} placeholder="https:// ou /endereco" onChange={event => setCustomUrl(event.target.value)} /></Field>
          <Button type="button" variant="secondary" size="sm" className="justify-self-start" disabled={saving || current.items.length >= 50} onClick={() => {
            const result = menuWriteSchema.safeParse({ version: current.version, items: [...current.items, { id: randomUUID(), type: "custom", label: customLabel, url: customUrl, newTab: false }] });
            if (!result.success) return void toast.error(result.error.issues[0].message);
            update(result.data.items); setCustomLabel(""); setCustomUrl("");
          }}>Adicionar</Button>
        </div>
      </Card>
    </aside>
    <form className="grid gap-4" aria-label={location === "main" ? "Editar menu principal" : "Editar menu do rodapé"} onSubmit={async event => {
      event.preventDefault(); if (saving) return;
      const result = menuWriteSchema.safeParse({ version: current.version, items: current.items });
      if (!result.success) return void toast.error(result.error.issues[0].message);
      setSaving(true);
      try {
        const next = await managementRequest(`/admin/menus/${location}`, menuSchema, "PATCH", result.data);
        const apply = (menus: MenuRecord[]) => menus.map(menu => menu.location === next.location ? next : menu);
        setMenus(apply); setSaved(apply); router.refresh(); toast.success("Menu salvo.");
      } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar o menu."); }
      finally { setSaving(false); }
    }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select className="w-auto max-w-full" aria-label="Menu" value={location} disabled={saving} onChange={event => setLocation(event.target.value as MenuLocation)}>
          <option value="main">Menu principal (sidebar)</option><option value="footer">Menu do rodapé</option>
        </Select>
        <Button type="button" variant="ghost" disabled={saving} onClick={() => window.location.reload()}>Recarregar menus</Button>
      </div>
      <ol className="grid gap-3" aria-label="Itens do menu">
        {current.items.map((item, index) => {
          const page = item.type === "page" ? initial.pages.find(page => page.id === item.pageId) : null;
          return <li key={item.id} aria-label={`Item ${index + 1}`}><Card asChild className="overflow-hidden p-0 sm:p-0"><details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border border-transparent p-4 font-semibold outline-none hover:bg-contrast/6 focus-visible:border-foreground [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 break-words">{item.label || "Sem título"}</span>
              <ChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </summary>
            <div className="grid gap-3 border-t border-contrast/6 p-4">
              <div className="flex items-end gap-2">
                <Field className="min-w-0 flex-1">Título<Input value={item.label} maxLength={80} required disabled={saving} onChange={event => replace(item.id, item => ({ ...item, label: event.target.value }))} /></Field>
                <div className="flex min-h-11 shrink-0 items-center gap-1">
                  <Button type="button" variant="ghost" size="icon-sm" disabled={saving || index === 0} aria-label={`Subir item ${index + 1}`} onClick={() => move(index, -1)}><ArrowUp className="size-4" aria-hidden="true" /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={saving || index === current.items.length - 1} aria-label={`Descer item ${index + 1}`} onClick={() => move(index, 1)}><ArrowDown className="size-4" aria-hidden="true" /></Button>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={saving} aria-label={`Remover item ${index + 1}`} onClick={() => update(current.items.filter(value => value.id !== item.id))}><Trash2 className="size-4" aria-hidden="true" /></Button>
                </div>
              </div>
              {item.type === "custom"
                ? <Field>URL<Input value={item.url} maxLength={2000} required disabled={saving} onChange={event => replace(item.id, value => value.type === "custom" ? { ...value, url: event.target.value } : value)} /></Field>
                : <p className="break-words text-sm text-muted">{item.type === "fixed" ? fixedMenuPages[item.target].href : page ? `/${page.slug}` : "Página removida"}</p>}
              {item.type === "page" && !page?.published && <Badge variant="secondary" className="w-fit">Oculta até a publicação</Badge>}
              <div className="grid gap-1.5 text-sm font-semibold">
                <span>Ícone</span>
                <IconPicker value={item.icon} disabled={saving} onValueChange={icon => replace(item.id, item => ({ ...item, icon }))} />
              </div>
              <Field className="flex items-center justify-between gap-3">Abrir em nova aba<Switch checked={item.newTab} disabled={saving} onCheckedChange={newTab => replace(item.id, item => ({ ...item, newTab }))} /></Field>
            </div>
          </details></Card></li>;
        })}
      </ol>
      {!current.items.length && <Card><p className="text-sm text-muted">Este menu está vazio. Adicione itens ao lado.</p></Card>}
      <div className="flex flex-wrap items-center gap-3"><Button type="submit" loading={saving} disabled={!dirty || saving}>Salvar menu</Button>{dirty && <p role="status" className="text-sm text-muted">Alterações não salvas.</p>}</div>
    </form>
  </div>;
}
