"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { achievementMetrics, achievementWriteSchema, achievementDefinitionSchema, type AchievementDefinition, type AchievementMetric, type IconName } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { IconPicker } from "@/components/ui/icon-picker";
import { ImagePicker } from "@/features/media/image-picker";
import { EditableRow } from "@/components/shared/editable-row";
import { managementRequest } from "@/features/admin/management-api";

type Level = AchievementDefinition["levels"][number];
const newLevel = (target: number): Level => ({id:crypto.randomUUID(),target,description:"",color:null,imageUrl:"",locked:false});
export function AdminAchievementEditor({ initial }: { initial?: AchievementDefinition }) {
  const router = useRouter();
  const [name,setName] = useState(initial?.name??"");
  const [icon,setIcon] = useState<IconName|null>(initial?.icon??"award");
  const [imageUrl,setImageUrl] = useState(initial?.imageUrl??"");
  const [color,setColor] = useState<string|null>(initial?.color??null);
  const [metric,setMetric] = useState<AchievementMetric>(initial?.metric??"games");
  const [active,setActive] = useState(initial?.active??true);
  const [order,setOrder] = useState(initial?.order??0);
  const [levels,setLevels] = useState<Level[]>(()=>initial?.levels??[newLevel(1)]);
  const [saving,setSaving] = useState(false);
  const locked = levels.some(level=>level.locked);
  const updateLevel = (index: number, patch: Partial<Level>)=>setLevels(items=>items.map((level,i)=>i===index?{...level,...patch}:level));
  return <>
    <h1 className="sr-only">{initial?"Editar conquista":"Criar conquista"}</h1>
    <form className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]" onSubmit={async event=>{
      event.preventDefault();if(saving)return;
      const input=achievementWriteSchema.safeParse({name,icon,imageUrl,color,metric,active,order,version:initial?.version??0,levels:levels.map(({id,target,description,color,imageUrl})=>({id,target,description,color,imageUrl}))});
      if(!input.success){toast.error(input.error.issues[0].message);return;}
      setSaving(true);
      try{
        const saved=await managementRequest(initial?`/admin/achievements/${initial.id}`:"/admin/achievements",achievementDefinitionSchema,initial?"PATCH":"POST",input.data);
        toast.success("Conquista salva.");router.replace(`/admin/conquistas/${saved.id}`);router.refresh();
      }catch(error){toast.error(error instanceof Error?error.message:"Não foi possível salvar a conquista.");}finally{setSaving(false);}
    }}>
      <div className="grid gap-5">
        <Card className="grid gap-5">
          <Field>Nome<Input value={name} maxLength={80} required onChange={event=>setName(event.target.value)} disabled={saving}/></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field>Critério<Select value={metric} disabled={saving||locked} onChange={event=>setMetric(event.target.value as AchievementMetric)}>{Object.entries(achievementMetrics).map(([value,item])=><option key={value} value={value}>{item.label}</option>)}</Select></Field><Field>Ícone<IconPicker value={icon} onValueChange={setIcon} disabled={saving}/></Field></div>
          <div className="grid gap-2"><p className="text-sm font-medium">Emblema</p><ImagePicker value={imageUrl} onChange={setImageUrl} label="Emblema da conquista" disabled={saving}/><p className="text-xs text-muted">Sem imagem, o card usa o ícone selecionado.</p></div>
          <ColorField label="Cor padrão" value={color} onChange={setColor} disabled={saving}/>
          {locked&&<p className="text-xs text-muted">O critério e as metas já conquistadas estão protegidos. Você pode editar textos, cores e imagens e adicionar níveis.</p>}
        </Card>
        <Card className="grid gap-5">
          <h2 className="font-semibold">Níveis</h2>
          {levels.map((level,index)=><fieldset key={level.id} disabled={saving} className="grid min-w-0 gap-4 border-b border-contrast/6 pb-5 last:border-0 last:pb-0">
            <legend className="mb-3 flex items-center gap-2 text-sm font-semibold">Nível {index+1}{level.locked&&<LockKeyhole className="size-3.5 text-muted" aria-label="Nível já conquistado"/>}</legend>
            <div className="grid min-w-0 gap-4 sm:grid-cols-[8rem_minmax(0,1fr)_auto]">
              <Field>Meta<Input type="number" min={1} max={Number.MAX_SAFE_INTEGER} step={1} required value={level.target||""} disabled={level.locked} onChange={event=>updateLevel(index,{target:Number(event.target.value)})}/></Field>
              <Field>Descrição<Input required maxLength={240} value={level.description} onChange={event=>updateLevel(index,{description:event.target.value})} placeholder="Ex.: Complete 25 partidas."/></Field>
              <Button variant="ghost" size="icon" className="self-end" aria-label={`Remover nível ${index+1}`} disabled={level.locked||levels.length===1} onClick={()=>setLevels(items=>items.filter(item=>item.id!==level.id))}><Trash2 className="size-4" aria-hidden="true"/></Button>
            </div>
            <ColorField label={`Cor do nível ${index+1}`} value={level.color} fallback={color} onChange={color=>updateLevel(index,{color})} disabled={saving} inheritedLabel="Usar cor padrão"/>
            <div className="grid gap-2"><p className="text-sm font-medium">Imagem do nível {index+1}</p><ImagePicker value={level.imageUrl} onChange={imageUrl=>updateLevel(index,{imageUrl})} label={`Imagem do nível ${index+1}`} disabled={saving}/><p className="text-xs text-muted">Sem imagem própria, usa o emblema padrão da conquista.</p></div>
          </fieldset>)}
          <Button variant="secondary" className="justify-self-start" disabled={saving} onClick={()=>setLevels(items=>[...items,newLevel(Math.min(Number.MAX_SAFE_INTEGER,(items.at(-1)?.target??0)+1))])}><Plus className="size-4" aria-hidden="true"/>Adicionar nível</Button>
        </Card>
      </div>
      <Card className="grid gap-4 xl:sticky xl:top-(--header-height)">
        <h2 className="font-semibold">Publicação</h2>
        <Field className="flex items-center justify-between">Conquista ativa<Switch checked={active} onCheckedChange={setActive} disabled={saving}/></Field>
        <Field>Ordem<Input type="number" min={0} max={2147483647} step={1} required value={order} onChange={event=>setOrder(Number(event.target.value))} disabled={saving}/></Field>
        <div><EditableRow label="Níveis" value={levels.length}/><EditableRow label="Critério" value={achievementMetrics[metric].label}/></div>
        <Button type="submit" loading={saving}>Salvar conquista</Button>
        <Button asChild variant="secondary"><Link href="/admin/conquistas">Voltar para conquistas</Link></Button>
      </Card>
    </form>
  </>;
}

function ColorField({ label, value, fallback, onChange, disabled, inheritedLabel = "Usar cor da marca" }: {
  label: string; value: string | null; fallback?: string | null; onChange: (color: string | null) => void; disabled: boolean; inheritedLabel?: string;
}) {
  return <div className="grid gap-2">
    <Field>{label}<Input type="color" className="w-20 cursor-pointer p-1" value={value??fallback??"#ff2c67"} onChange={event=>onChange(event.target.value)} disabled={disabled}/></Field>
    <div className="flex items-center gap-3 text-xs text-muted"><span>{value??inheritedLabel}</span>{value&&<Button variant="ghost" size="sm" disabled={disabled} onClick={()=>onChange(null)}>{inheritedLabel}</Button>}</div>
  </div>;
}
