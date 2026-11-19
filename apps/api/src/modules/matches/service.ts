import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { matchSchema, matchResultSchema, matchListSchema, type CreateMatch, type MatchCommand, type Match, type MatchFrame } from "@croebet/shared";
import { flip7Driver as driver } from "../games/flip7/driver.ts";
import { execute } from "./execution.ts";

export class MatchError extends Error {
  constructor(publicCode: string, status: number, message: string) { super(message); this.code = publicCode; this.status = status; }
  code: string;
  status: number;
}
type Row = { id: string; code: string; game_slug: "flip7"; rules_version: number; version: number; status: Match["status"]; state: unknown };
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function view(row: Row): Match {
  if (row.rules_version !== driver.rulesVersion) throw new MatchError("RULES_VERSION", 409, "Versão de regras indisponível.");
  return matchSchema.parse({ id: row.id, code: row.code, game: row.game_slug, rulesVersion: row.rules_version, version: row.version, status: row.status, state: driver.project(driver.parse(row.state)) });
}
async function transaction<T>(pool: Pool, actor: string, sessionHash: string, action: (client: PoolClient, username: string) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const user = await client.query(`select u.username from users u join sessions s on s.user_id=u.id
      where u.id=$1 and s.token_hash=$2 and u.status='active'
      and s.expires_at>clock_timestamp() and s.idle_expires_at>clock_timestamp() for update of u,s`, [actor, sessionHash]);
    if (!user.rows[0]) throw new MatchError("UNAUTHENTICATED", 401, "Entre novamente.");
    const result = await action(client, user.rows[0].username);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    if (error instanceof Error && error.message === "ILLEGAL_ACTION") throw new MatchError("ILLEGAL_ACTION", 409, "Esta ação não está disponível agora.");
    throw error;
  } finally { client.release(); }
}
export async function listMatches(pool: Pool, actor: string) {
  const rows = await pool.query("select * from game_matches where owner_id=$1 and status='playing' order by updated_at desc,id limit 30", [actor]);
  return matchListSchema.parse({ items: rows.rows.map(view) });
}
export async function getMatch(pool: Pool, actor: string, code: string) {
  const result = await pool.query("select * from game_matches where owner_id=$1 and code=$2 and status<>'abandoned'", [actor, code]);
  if (!result.rows[0]) throw new MatchError("NOT_FOUND", 404, "Partida não encontrada.");
  return view(result.rows[0]);
}
export async function createMatch(pool: Pool, actor: string, sessionHash: string, input: CreateMatch) {
  return transaction(pool, actor, sessionHash, async (client, username) => {
    const payloadHash = hash(input);
    const previous = await client.query("select creation_hash,creation_response from game_matches where owner_id=$1 and creation_request_id=$2", [actor, input.requestId]);
    if (previous.rows[0]) {
      if (previous.rows[0].creation_hash !== payloadHash) throw new MatchError("IDEMPOTENCY_CONFLICT", 409, "Este pedido já foi usado com outra configuração.");
      return matchResultSchema.parse(previous.rows[0].creation_response);
    }
    const active = await client.query("select count(*)::int as total from game_matches where owner_id=$1 and status='playing'", [actor]);
    if (active.rows[0].total >= 30) throw new MatchError("MATCH_LIMIT", 409, "Conclua ou abandone uma partida antes de começar outra.");
    const catalog = await client.query("select id from games where slug=$1 and enabled=true for share", [input.game]);
    if (!catalog.rows[0]) throw new MatchError("NOT_FOUND", 404, "Jogo indisponível.");
    const result = execute(driver, driver.create(input, username), 1);
    const row: Row = { id: randomUUID(), code: randomBytes(6).toString("hex").toUpperCase(), game_slug: input.game, rules_version: driver.rulesVersion, version: result.version, status: result.status, state: result.state };
    const response = matchResultSchema.parse({ match: view(row), before: result.before, frames: result.frames });
    await client.query(`insert into game_matches (id,code,game_id,game_slug,owner_id,rules_version,version,status,state,creation_request_id,creation_hash,creation_response)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`, [row.id,row.code,catalog.rows[0].id,input.game,actor,row.rules_version,row.version,row.status,JSON.stringify(row.state),input.requestId,payloadHash,JSON.stringify(response)]);
    for (const [seat, player] of result.state.players.entries()) await client.query(`insert into game_match_players (match_id,seat,user_id,controller_id,name,kind) values ($1,$2,$3,$4,$5,$6)`, [row.id,seat,seat === 0 ? actor : null,player.kind === "human" ? actor : null,player.name,seat === 0 ? "user" : player.kind === "human" ? "guest" : "bot"]);
    await recordFrames(client, row.id, response.frames);
    return response;
  });
}
async function recordFrames(client: PoolClient, matchId: string, frames: MatchFrame[]) {
  // These are public presentation events; the private deck remains only in state.
  for (const frame of frames) {
    await client.query("insert into game_match_events (match_id,version,event) values ($1,$2,$3)", [matchId,frame.version,JSON.stringify(frame)]);
  }
}
export async function commandMatch(pool: Pool, actor: string, sessionHash: string, code: string, input: MatchCommand | { commandId: string; expectedVersion: number }, abandon = false) {
  return transaction(pool, actor, sessionHash, async client => {
    const found = await client.query("select * from game_matches where owner_id=$1 and code=$2 for update", [actor,code]);
    const row = found.rows[0] as Row | undefined;
    if (!row) throw new MatchError("NOT_FOUND", 404, "Partida não encontrada.");
    const payloadHash = hash({ abandon, input });
    // An accepted retry returns its receipt even if its expectedVersion is now old.
    const previous = await client.query("select payload_hash,response from game_match_commands where match_id=$1 and command_id=$2", [row.id,input.commandId]);
    if (previous.rows[0]) {
      if (previous.rows[0].payload_hash !== payloadHash) throw new MatchError("IDEMPOTENCY_CONFLICT", 409, "Este comando já foi usado para outra ação.");
      return matchResultSchema.parse(previous.rows[0].response);
    }
    if (row.version !== input.expectedVersion || row.status !== "playing") throw new MatchError("VERSION_CONFLICT", 409, "A partida mudou. Recarregue para continuar.");
    if (!abandon) {
      const enabled = await client.query("select 1 from games g join game_matches m on m.game_id=g.id where m.id=$1 and g.enabled=true for share of g", [row.id]);
      if (!enabled.rows[0]) throw new MatchError("NOT_FOUND", 404, "Jogo indisponível.");
    }
    const state = driver.parse(row.state);
    const result = abandon ? { state, before: driver.project(state), frames: [], version: row.version + 1, status: "abandoned" as const } : execute(driver, state, row.version, "action" in input ? input.action : undefined);
    const response = matchResultSchema.parse({ match: view({ ...row, ...result }), before: result.before, frames: result.frames });
    await client.query("update game_matches set state=$2,version=$3,status=$4,updated_at=clock_timestamp() where id=$1", [row.id,JSON.stringify(result.state),result.version,result.status]);
    await recordFrames(client,row.id,response.frames);
    await client.query("insert into game_match_commands (match_id,command_id,payload_hash,response) values ($1,$2,$3,$4)", [row.id,input.commandId,payloadHash,JSON.stringify(response)]);
    return response;
  });
}
