"use client";
import { gameUrl } from "./game-url";
import {useRouter,useSearchParams} from "next/navigation";
import {useSession} from "@/features/auth/session-context";
import {Switch} from "@/components/ui/switch";
export function GameModeSwitch({slug,development=false}:{slug:string;development?:boolean}){
 const {permissions}=useSession(),router=useRouter(),query=useSearchParams();
 if(!permissions.canManageSite || !["flip7","love-letter"].includes(slug))return null;
 const developmentOnly=slug==="love-letter";
 return <div className="flex shrink-0 justify-end"><label className="absolute top-0 right-0 whitespace-nowrap flex items-center gap-2 text-sm">Modo dev<Switch checked={developmentOnly || development || query.get("teste")==="1"} disabled={developmentOnly} onCheckedChange={checked=>router.push(gameUrl(slug,{development:checked}))}/></label></div>;
}
