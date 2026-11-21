import type { Pool, PoolClient } from "pg";
import { chatMessageSchema, chatPageSchema, chatSyncSchema, type chatSendSchema } from "@croebet/shared";
import type { z } from "zod";
import { avatarUrl } from "../avatars/storage.ts";

export class ChatError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number, message: string) { super(message); this.code=code; this.status=status; }
}
const columns = `m.id::text, m.user_id, u.username, u.display_name, u.avatar_key, m.text, m.created_at, m.deleted_at`;
type Row = { id: string; user_id: string | null; username: string | null; display_name: string | null; avatar_key: string | null; text: string; created_at: Date; deleted_at: Date | null };
const project = (row: Row) => chatMessageSchema.parse({ id: row.id, userId: row.user_id, username: row.username, name: row.display_name || row.username || "Conta excluída", avatarUrl: avatarUrl(row.avatar_key), text: row.deleted_at ? null : row.text, createdAt: row.created_at.toISOString(), deleted: !!row.deleted_at });
async function mutedUntil(client: PoolClient, userId: string) {
  const result = await client.query('select "until" from chat_mutes where user_id=$1 and "until">clock_timestamp()', [userId]);
  return result.rows[0]?.until.toISOString() ?? null;
}
async function actor(client: PoolClient, userId: string, hash: string) {
  const result = await client.query(`select u.role from users u join sessions s on s.user_id=u.id where u.id=$1 and s.token_hash=$2 and u.status='active' and s.expires_at>clock_timestamp() and s.idle_expires_at>clock_timestamp() for share of u,s`, [userId, hash]);
  if (!result.rows.length) throw new ChatError("UNAUTHENTICATED", 401, "Entre novamente.");
  return result.rows[0];
}
async function transaction<T>(pool: Pool, mutate: boolean, work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query(mutate ? "begin" : "begin isolation level repeatable read read only");
    // Serialize chat writes so event IDs always follow commit order, including across API processes.
    if (mutate) await client.query("select pg_advisory_xact_lock(47851239)");
    const result = await work(client);
    await client.query("commit"); return result;
  } catch (error) { await client.query("rollback"); throw error; } finally { client.release(); }
}
export function readChat(pool: Pool, userId: string, before?: string) {
  return transaction(pool, false, async client => {
    const rows = await client.query<Row>(`select ${columns} from chat_messages m left join users u on u.id=m.user_id where ($1::bigint is null or m.id<$1) order by m.id desc limit 51`, [before ?? null]);
    const cursor = (await client.query("select coalesce(max(id),0)::text as cursor from chat_events")).rows[0].cursor;
    return chatPageSchema.parse({ items: rows.rows.slice(0,50).reverse().map(project), hasMore: rows.rows.length>50, cursor, mutedUntil: await mutedUntil(client,userId) });
  });
}
export function syncChat(pool: Pool, userId: string, after: string) {
  return transaction(pool, false, async client => {
    const events = await client.query<{ id: string; kind: string; message_id: string | null }>("select e.id::text, e.kind, e.message_id::text from chat_events e where e.id>$1 order by e.id limit 201", [after]);
    const page = events.rows.slice(0,200);
    const ids = page.flatMap(event => event.message_id ? [event.message_id] : []);
    const messages = await client.query<Row>(`select ${columns} from chat_messages m left join users u on u.id=m.user_id where m.id=any($1::bigint[])`, [ids]);
    const byId = new Map(messages.rows.map(row => [row.id, project(row)]));
    return chatSyncSchema.parse({ events: page.map(event => ({ id:event.id, kind:event.kind, message: event.message_id ? byId.get(event.message_id) ?? null : null })), cursor: page.at(-1)?.id ?? after, hasMore: events.rows.length>200, mutedUntil: await mutedUntil(client,userId) });
  });
}
async function notify(client: PoolClient) { await client.query("select pg_notify('croebet_chat','changed')"); }
export function sendChat(pool: Pool, userId: string, hash: string, input: z.infer<typeof chatSendSchema>) {
  return transaction(pool, true, async client => {
    await actor(client,userId,hash);
    const existing = await client.query("select id::text,user_id,text from chat_messages where request_id=$1", [input.requestId]);
    if (existing.rows[0]) {
      if (existing.rows[0].user_id !== userId || existing.rows[0].text !== input.text) throw new ChatError("CONFLICT",409,"Pedido já utilizado.");
      return { id: existing.rows[0].id };
    }
    if (await mutedUntil(client,userId)) throw new ChatError("CHAT_MUTED",403,"Você está silenciado no chat.");
    const recent = await client.query(`select count(*)::int as count, coalesce(bool_or(created_at>clock_timestamp()-interval '2 seconds'),false) as fast from chat_messages where user_id=$1 and created_at>clock_timestamp()-interval '1 minute'`, [userId]);
    if (recent.rows[0].fast || recent.rows[0].count>=20) throw new ChatError("RATE_LIMIT",429,"Aguarde um pouco antes de enviar outra mensagem.");
    const result = await client.query("insert into chat_messages(user_id,request_id,text) values($1,$2,$3) returning id::text",[userId,input.requestId,input.text]);
    await client.query("insert into chat_events(kind,message_id,actor_id) values('message',$1,$2)",[result.rows[0].id,userId]);
    await notify(client); return { id: result.rows[0].id };
  });
}
export function moderateChat(pool: Pool, userId: string, hash: string, action: { kind: "delete"; id: string } | { kind: "mute"; id: string; minutes: number }) {
  return transaction(pool,true,async client => {
    if ((await actor(client,userId,hash)).role!=="admin") throw new ChatError("FORBIDDEN",403,"Acesso restrito à administração.");
    if (action.kind==="delete") {
      const result = await client.query("update chat_messages set deleted_at=clock_timestamp(),deleted_by=$2 where id=$1 and deleted_at is null returning id",[action.id,userId]);
      if (result.rows.length) await client.query("insert into chat_events(kind,message_id,actor_id) values('delete',$1,$2)",[action.id,userId]);
    } else {
      const target = await client.query("select id from users where id=$1 for share",[action.id]);
      if (!target.rows.length) throw new ChatError("NOT_FOUND",404,"Usuário não encontrado.");
      const result = await client.query(`insert into chat_mutes(user_id,"until") values($1,clock_timestamp()+make_interval(mins=>$2)) on conflict(user_id) do update set "until"=excluded."until" returning "until"`,[action.id,action.minutes]);
      await client.query("insert into chat_events(kind,subject_id,actor_id,muted_until) values('mute',$1,$2,$3)",[action.id,userId,result.rows[0].until]);
    }
    await notify(client); return { ok:true as const };
  });
}
