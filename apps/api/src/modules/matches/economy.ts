import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { z } from "zod";
import { matchPayoutSchema, type Flip7View } from "@croebet/shared";
import { transferCroinsInTransaction } from "../wallet/service.ts";

const house = "00000000-0000-4000-8000-000000000002";
const contributionsSchema = z.array(z.object({ accountId: z.uuid(), userId: z.uuid(), seat: z.number().int().min(0).max(11) }));
export class MatchEconomyError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.code=code; }
}

export function splitPot(total: number, seats: number[]) {
  const ordered = [...seats].sort((a,b)=>a-b);
  if (!Number.isSafeInteger(total) || total < 1 || !ordered.length || new Set(ordered).size !== ordered.length) throw new Error("Invalid pot distribution");
  const amount = BigInt(total), count = BigInt(ordered.length);
  return ordered.map((seat,index)=>({ seat, amount: Number(amount/count + (BigInt(index)<amount%count?1n:0n)) }));
}

export async function fundMatch(client: PoolClient, id: string, code: string, entry: number, people: {userId:string;seat:number;username:string}[]) {
  if (!entry) return;
  const total=BigInt(entry)*BigInt(people.length);
  if(total>BigInt(Number.MAX_SAFE_INTEGER))throw new MatchEconomyError("POT_TOO_LARGE","O total do pote ultrapassa o limite suportado. Reduza a entrada.");
  const accounts=await client.query<{id:string;user_id:string;balance:string}>("select id,user_id,balance from wallet_accounts where user_id=any($1::uuid[]) order by id for update",[people.map(p=>p.userId)]);
  const missing=people.filter(p=>!accounts.rows.some(a=>a.user_id===p.userId && BigInt(a.balance)>=BigInt(entry)));
  if(missing.length)throw new MatchEconomyError("INSUFFICIENT_FUNDS",`Saldo insuficiente: ${missing.map(p=>p.username).join(", ")}. Ninguém foi cobrado.`);
  const pot=randomUUID();
  await client.query("insert into wallet_accounts(id,kind) values($1,'pot')",[pot]);
  const contributions=people.map(p=>({userId:p.userId,seat:p.seat,accountId:accounts.rows.find(a=>a.user_id===p.userId)!.id}));
  await client.query("insert into game_match_stakes(match_id,pot_account_id,entry_amount,pot_total,contributions) values($1,$2,$3,$4,$5)",[id,pot,entry,total.toString(),JSON.stringify(contributions)]);
  for(const person of contributions)await transferCroinsInTransaction(client,{scope:"match-entry",idempotencyKey:`${id}:${person.seat}`,from:person.accountId,to:pot,actorAccountId:person.accountId,amount:entry,reason:"Entrada no Flip 7",reference:code});
}

export async function settleMatch(client: PoolClient, id: string, code: string, status: string, state: Flip7View) {
  if(status!=="finished" && status!=="abandoned")return;
  const row=(await client.query("select * from game_match_stakes where match_id=$1 for update",[id])).rows[0];
  if(!row || row.status!=="pending")return;
  const people=contributionsSchema.parse(row.contributions);
  const maximum=Math.max(...state.players.map(p=>p.total));
  const seats=status==="abandoned"?people.map(p=>p.seat):state.players.flatMap((p,seat)=>p.total===maximum?[seat]:[]);
  const payouts=splitPot(Number(row.pot_total),seats).map(p=>({...p,house:status==="abandoned" || state.players[p.seat].kind!=="human"}));
  // Lock every destination together before transfers; concurrent wallets use the same order.
  await client.query("select id from wallet_accounts where id=any($1::uuid[]) order by id for update",[[house,row.pot_account_id,...people.map(p=>p.accountId)]]);
  for(const payout of payouts){
    if(!payout.amount)continue;
    const person=people.find(p=>p.seat===payout.seat)!;
    await transferCroinsInTransaction(client,{scope:"match-prize",idempotencyKey:`${id}:${payout.seat}`,from:row.pot_account_id,to:payout.house?house:person.accountId,actorAccountId:row.pot_account_id,amount:payout.amount,reason:payout.house?"Prêmio de vaga com bot no Flip 7":"Prêmio do Flip 7",reference:code});
  }
  await client.query("update game_match_stakes set status='paid',payouts=$2,settled_at=clock_timestamp() where match_id=$1",[id,JSON.stringify(payouts)]);
}

export async function readMatchEconomy(client: PoolClient | import("pg").Pool, id: string) {
  const row=(await client.query("select pot_total,payouts,status from game_match_stakes where match_id=$1",[id])).rows[0];
  return row?{potTotal:Number(row.pot_total),payouts:z.array(matchPayoutSchema).parse(row.payouts),settlement:row.status}:{};
}

/** Called under the lifecycle lock before operational rooms/accounts are removed. */
export async function refundAccountMatches(client: PoolClient, userId: string) {
  const matches=await client.query(`select m.id,m.code,s.* from game_matches m join game_match_stakes s on s.match_id=m.id
    where s.status='pending' and (m.created_by=$1 or m.owner_id=$1 or exists(select 1 from game_match_players p where p.match_id=m.id and p.user_id=$1)) order by m.id for update of m,s`,[userId]);
  for(const row of matches.rows){
    const people=contributionsSchema.parse(row.contributions);
    await client.query("select id from wallet_accounts where id=any($1::uuid[]) order by id for update",[[row.pot_account_id,...people.map(p=>p.accountId)]]);
    for(const person of people)await transferCroinsInTransaction(client,{scope:"match-refund",idempotencyKey:`${row.match_id}:${person.seat}`,from:row.pot_account_id,to:person.accountId,actorAccountId:row.pot_account_id,amount:Number(row.entry_amount),reason:"Devolução de partida encerrada do Flip 7",reference:row.code});
    await client.query("update game_match_stakes set status='refunded',settled_at=clock_timestamp() where match_id=$1",[row.match_id]);
  }
}

/** Caller owns the lifecycle/room lock; refund and closure commit together. */
export async function refundCollectiveMatch(client:PoolClient,id:string,code:string){
 const row=(await client.query("select * from game_match_stakes where match_id=$1 for update",[id])).rows[0];
 if(!row)return;
 if(row.status!=="pending")throw new MatchEconomyError("POT_ALREADY_SETTLED","O pote já foi liquidado. Não é possível cancelar esta partida.");
 const people=contributionsSchema.parse(row.contributions);
 await client.query("select id from wallet_accounts where id=any($1::uuid[]) order by id for update",[[row.pot_account_id,...people.map(p=>p.accountId)]]);
 for(const person of people)await transferCroinsInTransaction(client,{scope:"match-refund",idempotencyKey:`${id}:${person.seat}`,from:row.pot_account_id,to:person.accountId,actorAccountId:row.pot_account_id,amount:Number(row.entry_amount),reason:"Devolução por abandono coletivo",reference:code});
 await client.query("update game_match_stakes set status='refunded',payouts=$2,settled_at=clock_timestamp() where match_id=$1",[id,JSON.stringify(people.map(p=>({seat:p.seat,amount:Number(row.entry_amount),house:false})))]);
}
