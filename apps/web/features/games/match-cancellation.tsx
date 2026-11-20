"use client";
import {useState} from "react";
import {LogOut} from "lucide-react";
import {toast} from "sonner";
import {commandResultSchema,type Match} from "@croebet/shared";
import {randomUUID} from "@/lib/uuid";
import {managementRequest} from "@/features/admin/management-api";
import {useSession} from "@/features/auth/session-context";
import {Button} from "@/components/ui/button";
import {Card} from "@/components/ui/card";
import {Dialog,DialogContent,DialogTitle,DialogDescription,DialogClose} from "@/components/ui/dialog";

type CancellationMatch=Pick<Match,"code"|"version"|"participants"|"entryAmount"|"cancellation">;
export async function proposeCancellation(match:Pick<Match,"code"|"version">){
 await managementRequest(`/matches/${match.code}/cancel-proposal`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:match.version});
 toast.info("Proposta enviada. A partida só será encerrada com aprovação unânime.");
}
export function CancellationNotice({match}:{match:CancellationMatch}){
 const {userId}=useSession(),[busy,setBusy]=useState(false);const proposal=match.cancellation;
 if(!proposal || !userId || !proposal.eligibleUserIds.includes(userId))return null;
 const accepted=proposal.acceptedUserIds.includes(userId);
 async function vote(accept:boolean){if(busy || !proposal)return;setBusy(true);try{await managementRequest(`/matches/${match.code}/cancel-vote`,commandResultSchema,"POST",{commandId:randomUUID(),expectedVersion:match.version,proposalId:proposal.id,accept});}catch(e){toast.error(e instanceof Error?e.message:"Não foi possível votar.");}finally{setBusy(false);}}
 const proposer=match.participants.find(p=>p.userId===proposal.proposedBy);
 return <Card role="alert" className="mb-4 space-y-3"><p className="text-sm font-medium">{proposer?.displayName || proposer?.username || "Um jogador"} propôs abandonar a partida coletivamente.</p><p className="text-sm text-muted">A aprovação de todos encerra a partida sem resultado e devolve todas as entradas, inclusive de quem já saiu. {proposal.acceptedUserIds.length}/{proposal.eligibleUserIds.length} aprovaram.</p>{accepted?<p className="text-sm text-muted">Você aprovou. Aguardando os demais jogadores.</p>:<div className="flex flex-wrap gap-2"><Button size="sm" loading={busy} disabled={busy} onClick={()=>void vote(true)}>Aprovar abandono coletivo</Button><Button size="sm" variant="secondary" disabled={busy} onClick={()=>void vote(false)}>Continuar partida</Button></div>}</Card>;
}
/** The same door handles participants and the admin observing an all-bot test. */
export function MatchExitControl({match,onIndividual,onEndTest,onOpen,label}:{label?:string;match:CancellationMatch;onIndividual?:()=>Promise<void>;onEndTest?:()=>Promise<void>;onOpen?:()=>void}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 async function act(action:()=>Promise<void>){if(busy)return;setBusy(true);try{await action();setOpen(false);}catch(e){toast.error(e instanceof Error?e.message:"Não foi possível sair da partida.");}finally{setBusy(false);}}
 return <><Button size={label?"sm":"icon"} variant="ghost" aria-label={label ?? (onEndTest?"Encerrar teste":"Sair da partida")} title={label ?? (onEndTest?"Encerrar teste":"Sair da partida")} onClick={()=>{onOpen?.();setOpen(true);}}>{label ?? <LogOut className="size-4" aria-hidden="true"/>}</Button><Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent><DialogTitle>{onEndTest?"Encerrar partida de teste?":"Sair da partida?"}</DialogTitle><DialogDescription className="mt-3 text-sm text-muted">{onEndTest?"Esta ação encerra o teste inteiro. Não há Croins envolvidos.":"Abandonar sozinho entrega sua vaga a um bot e você perde sua entrada. No abandono coletivo, todos os jogadores que continuam precisam aprovar; todas as entradas são devolvidas e a partida fica sem resultado."}</DialogDescription><div className="mt-6 flex flex-wrap justify-end gap-2"><DialogClose asChild><Button variant="secondary" disabled={busy}>Continuar</Button></DialogClose>{onIndividual && <><Button variant="secondary" disabled={busy || !!match.cancellation} onClick={()=>void act(()=>proposeCancellation(match))}>Propor abandono coletivo</Button><Button variant="destructive" disabled={busy} loading={busy} onClick={()=>void act(onIndividual)}>Abandonar sozinho</Button></>}{onEndTest && <Button variant="destructive" disabled={busy} loading={busy} onClick={()=>void act(onEndTest)}>Encerrar teste</Button>}</div></DialogContent></Dialog></>;
}
