import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { achievementDefinitionSchema, achievementDefinitionsSchema, resourceIdSchema } from "@croebet/shared";
import { getManagement } from "@/features/admin/server-management";
import { AdminAccess } from "@/features/admin/admin-access";
import { AdminAchievementEditor } from "@/features/admin/admin-achievement-editor";
import { ManagementUnavailable } from "@/features/admin/management-shared";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return {title:`${(await params).id==="nova"?"Criar conquista":"Editar conquista"} · Admin · Croebet`};
}
export default async function AdminAchievementPage({ params }: { params: Promise<{id:string}> }) {
  const {id}=await params;
  if(id==="nova"){
    const authorized=await getManagement("/admin/achievements",achievementDefinitionsSchema);
    return <AdminAccess section="achievements" content={authorized?<AdminAchievementEditor/>:<ManagementUnavailable/>}/>;
  }
  if(!resourceIdSchema.safeParse(id).success)notFound();
  const data=await getManagement(`/admin/achievements/${id}`,achievementDefinitionSchema);
  return <AdminAccess section="achievements" content={data?<AdminAchievementEditor key={`${id}:${data.version}`} initial={data}/>:<ManagementUnavailable/>}/>;
}
