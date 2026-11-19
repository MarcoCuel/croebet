import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import type { ServerResponse } from "node:http";
import { matchCodeSchema } from "@croebet/shared";
import { tokenHash } from "../auth/security.ts";
import { getRoomSync, listLobbies, MatchError } from "./service.ts";

type Connection = { response: ServerResponse; actor: string; session: string; code?: string; version: number; directory: string; checked: number };
/** One database watcher per API process; clients receive SSE, never poll HTTP.
 * Versions/events remain in PostgreSQL, so reconnect and process restart catch up.
 */
export function matchLive(app: FastifyInstance, pool: Pool, sessionName: string, origin: string | undefined) {
  const connections = new Set<Connection>();
  let running: Promise<void> | undefined;
  const write = (c: Connection, event: string, data: unknown, version?: number) => {
    if (c.response.destroyed || c.response.writableLength > 1024 * 1024) { c.response.destroy(); connections.delete(c); return false; }
    c.response.write(`${version===undefined?"":`id: ${version}\n`}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); return true;
  };
  async function update() {
    if (!connections.size) return;
    const codes = [...new Set([...connections].flatMap(c => c.code ? [c.code] : []))];
    const versions = await pool.query<{code:string;version:number}>("select code,version from game_matches where code=any($1::text[])",[codes]);
    const byCode = new Map(versions.rows.map(row => [row.code,row.version]));
    const directory = await pool.query("select m.code,m.version,g.enabled from game_matches m join games g on g.id=m.game_id where m.status='lobby' order by m.code");
    const signature = JSON.stringify(directory?.rows);
    const lobbies = new Map<string,Awaited<ReturnType<typeof listLobbies>>>();
    for (const c of connections) {
      try {
        const changed=(c.code && (c.version===0 || byCode.get(c.code)!==c.version)) || c.directory!==signature;
        if (changed || Date.now()-c.checked > 15000) {
          const session=await pool.query("select 1 from sessions s join users u on u.id=s.user_id where s.token_hash=$1 and s.user_id=$2 and u.status='active' and s.expires_at>clock_timestamp() and s.idle_expires_at>clock_timestamp()",[c.session,c.actor]);
          if (!session.rows.length) throw new MatchError("UNAUTHENTICATED",401,"Entre novamente.");
          c.checked=Date.now(); c.response.write(": heartbeat\n\n");
        }
        if (c.code && (c.version===0 || byCode.get(c.code)!==c.version)) {
          const data=await getRoomSync(pool,c.actor,c.code,c.version);
          if(write(c,"room",data,data.room.version)) c.version=data.room.version;
        }
        if (c.directory!==signature) {
          let data=lobbies.get(c.actor);
          if(!data){data=await listLobbies(pool,c.actor);lobbies.set(c.actor,data);}
          if(write(c,"lobbies",data)) c.directory=signature;
        }
      } catch(error) {
        if(error instanceof MatchError) { write(c,"closed",{code:error.code,message:error.message}); c.response.end(); connections.delete(c); }
        else { c.response.destroy(); connections.delete(c); }
      }
    }
  }
  const timer=setInterval(()=>{ running ??= update().catch(()=>{ for(const c of connections) c.response.destroy(); connections.clear(); }).finally(()=>{running=undefined;}); },750);
  timer.unref();
  app.addHook("preClose",async()=>{clearInterval(timer);for(const c of connections)c.response.end();connections.clear();await running;});
  return async (request: FastifyRequest, reply: FastifyReply, actor: string) => {
    if (request.headers.origin && request.headers.origin!==origin) return reply.code(403).send({error:{code:"ORIGIN_INVALID",message:"Origem inválida."}});
    if (connections.size>=200 || [...connections].filter(c=>c.actor===actor).length>=6) return reply.code(429).send({error:{code:"CONNECTION_LIMIT",message:"Muitas conexões abertas."}});
    const query=request.query as Record<string,string>;
    const code=query.code===undefined ? undefined : matchCodeSchema.parse(query.code);
    const version=Number(request.headers["last-event-id"] ?? query.afterVersion ?? 0);
    if(!Number.isSafeInteger(version) || version<0) return reply.code(400).send({error:{code:"INVALID_INPUT",message:"Versão inválida."}});
    // Authorize and load before committing headers; never expose another table.
    const initial=code ? await getRoomSync(pool,actor,code,version) : null;
    const directory=await listLobbies(pool,actor);
    reply.hijack();
    reply.raw.writeHead(200,{"Content-Type":"text/event-stream; charset=utf-8","Cache-Control":"no-cache, no-store, no-transform","Connection":"keep-alive","X-Accel-Buffering":"no"});
    const c:Connection={response:reply.raw,actor,session:tokenHash(request.cookies[sessionName]!),code,version:0,directory:"",checked:Date.now()};
    connections.add(c);
    if(initial){write(c,"room",initial,initial.room.version);c.version=initial.room.version;}
    write(c,"lobbies",directory);
    reply.raw.on("close",()=>connections.delete(c));
  };
}
