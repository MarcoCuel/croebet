"use client";
import {useRouter,useSearchParams} from "next/navigation";
import {useSession} from "@/features/auth/session-context";
import {Switch} from "@/components/ui/switch";
export function GameModeSwitch({slug,development=false}:{slug:string;development?:boolean}){
 const {permissions}=useSession(),router=useRouter(),query=useSearchParams();
 if(!permissions.canManageSite || !["flip7","love-letter"].includes(slug))return null;
 return <div className="flex shrink-0 justify-end"><label className="flex items-center gap-2 text-sm">Modo dev<Switch checked={development || query.get("teste")==="1"} onCheckedChange={checked=>router.push(`/jogos/${slug}${checked?"?teste=1":""}`)}/></label></div>;
}
