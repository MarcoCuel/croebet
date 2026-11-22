import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { lobbyPlayersSchema, lobbyInvitationsSchema, lobbySchema, lobbyListSchema, lobbyActionResultSchema, updateLobbySchema, gameExecutionResultSchema, matchListSchema,  type CreateMatch, type GameCommand, type GameView, type GameEngineAction, type GameId, type GameRoom, type MatchParticipant, type Room, type UpdateLobby, type KickMatch } from "@croebet/shared";
import { gameDriver } from "../games/registry.ts";
import { cancellationProposalSchema, createMatchSchema, gameRoomSchema, gameRoomSyncSchema, gameMatchResultSchema, personalMatchesSchema, gameDefinitions } from "@croebet/shared";

import { avatarUrl } from "../avatars/storage.ts";
import { refundCollectiveMatch, fundMatch, settleMatch, readMatchEconomy, MatchEconomyError } from "./economy.ts";
import { WalletError } from "../wallet/service.ts";
import { execute } from "./execution.ts";

export class MatchError extends Error {
  code: string; status: number;
  constructor(code: string, status: number, message: string) { super(message); this.code=code; this.status=status; }
}
export const matchLifecycleLock = "select pg_advisory_xact_lock(47851234)";

type Row = { lobby_expires_at: Date; development:boolean; bots:number; only_bots:boolean; entry_amount: string; created_by: string; id: string; code: string; game_id: string; game_slug: GameId; owner_id: string; capacity: number; options: unknown; rules_version: number; version: number; status: Room["status"]; state: unknown };
type ParticipantRow = { match_id: string; user_id: string; username: string; display_name: string; avatar_key: string | null; seat: number };
type Client = Pool | PoolClient;
type Frame = {version:number;state:GameView;action:GameEngineAction|{type:"start"}|{type:"replace";seat:number}};
function resolveDriver(row:Row) {
  const driver=gameDriver(row.game_slug);
  if(row.rules_version!==driver.rulesVersion)throw new MatchError("RULES_VERSION",409,"Versão de regras indisponível.");
  return driver;
}

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function participants(client: Client, ids: string[]) {
  const result = new Map<string,MatchParticipant[]>();
  if (!ids.length) return result;
  const rows = await client.query<ParticipantRow>(`select p.match_id,p.user_id,p.seat,u.username,u.display_name,u.avatar_key from game_match_players p join users u on u.id=p.user_id where p.match_id=any($1::uuid[]) order by p.match_id,p.joined_at,p.seat`,[ids]);
  for (const row of rows.rows) {
    const list=result.get(row.match_id) ?? [];
    list.push({ userId:row.user_id,username:row.username,displayName:row.display_name,avatarUrl:avatarUrl(row.avatar_key),seat:row.seat });
    result.set(row.match_id,list);
  }
  return result;
}
function view(row: Row, members: MatchParticipant[], seat:number|null=null): GameRoom {
  const driver=resolveDriver(row);
  const common={ development:row.development,bots:row.bots,onlyBots:row.only_bots, entryAmount:Number(row.entry_amount ?? 0), id:row.id,code:row.code,game:row.game_slug,rulesVersion:row.rules_version,version:row.version,hostId:row.owner_id,capacity:row.capacity,options:gameDefinitions[row.game_slug].options.parse(row.options),participants:members };
  return row.status==="lobby" ? lobbySchema.parse({ ...common,status:"lobby",state:null,lobbyExpiresAt:row.development?null:row.lobby_expires_at?.toISOString() }) : gameRoomSchema.parse({ ...common,status:row.status,state:driver.projectFor(driver.parse(row.state),seat) });
}
async function reservations(client: Client, id: string) {
  return (await client.query<{userId:string;username:string;displayName:string;avatarUrl:string|null}>(`select u.id as "userId",u.username,u.display_name as "displayName",u.avatar_key as "avatarUrl" from game_match_invitations i join users u on u.id=i.recipient_id where i.match_id=$1 and i.expires_at>clock_timestamp() and not exists(select 1 from game_match_players p where p.match_id=i.match_id and p.user_id=i.recipient_id) order by i.expires_at,i.id`,[id])).rows.map(p=>({...p,avatarUrl:avatarUrl(p.avatarUrl)}));
}
async function roomView(client: Client, row: Row, members: MatchParticipant[], seat:number|null=null): Promise<GameRoom> {
  const room=gameRoomSchema.parse({...view(row,members,seat),...(Number(row.entry_amount)>0?await readMatchEconomy(client,row.id):{})});
  if (room.status === "finished") {
    const timing = await client.query<{ seconds: string | null; active: string | null }>(`select
      floor(greatest(0,extract(epoch from (coalesce(a.ended_at,m.ended_at)-coalesce(a.started_at,m.started_at)))))::text as seconds,
      case when development and only_bots and m.started_at is not null then floor(playback_milliseconds/1000.0)::text end as active
      from game_matches m left join game_match_archives a on a.id=m.id where m.id=$1 and m.ended_at is not null and m.started_at is not null`, [row.id]);
    if ("durationSeconds" in room) {
      room.durationSeconds = timing.rows[0]?.seconds == null ? null : Number(timing.rows[0].seconds);
      room.activeDurationSeconds = timing.rows[0]?.active == null ? null : Number(timing.rows[0].active);
    }
  }
  if(room.status!=="lobby")return {...room,cancellation:row.status==="playing"?await readCancellation(client,row.id):null};
  room.confirmedUserIds=Number(row.entry_amount)>0?(await client.query<{user_id:string}>("select user_id from game_match_players where match_id=$1 and (confirmed_entry_amount=$2 or user_id=$3) order by seat",[row.id,row.entry_amount,row.owner_id])).rows.map(p=>p.user_id):[];
  room.pendingInvitations=await reservations(client,row.id);
  room.onlineUserIds=(await client.query<{user_id:string}>("select distinct user_id from match_presence where match_id=$1 and expires_at>clock_timestamp() order by user_id",[row.id])).rows.map(p=>p.user_id);
  return room;
}
async function transaction<T>(pool: Pool, actor: string, sessionHash: string, action: (client: PoolClient, username: string) => Promise<T>, lifecycle = false): Promise<T> {
  const client=await pool.connect();
  try {
    await client.query("begin");
    // Starts can remove seats from several rooms. Serialize lifecycle writes before
    // account/room locks so overlapping starts cannot claim the same person.
    if (lifecycle) await client.query(matchLifecycleLock);
    const user=await client.query(`select u.username from users u join sessions s on s.user_id=u.id where u.id=$1 and s.token_hash=$2 and u.status='active' and s.expires_at>clock_timestamp() and s.idle_expires_at>clock_timestamp() for update of u,s`,[actor,sessionHash]);
    if (!user.rows[0]) throw new MatchError("UNAUTHENTICATED",401,"Entre novamente.");
    const result=await action(client,user.rows[0].username);
    await client.query("commit"); return result;
  } catch(error) {
    await client.query("rollback");
    if(error instanceof Error && error.message==="ILLEGAL_ACTION") throw new MatchError("ILLEGAL_ACTION",409,"Esta ação não está disponível agora.");
    if(error instanceof MatchEconomyError)throw new MatchError(error.code,409,error.message);
    if(error instanceof WalletError)throw new MatchError(error.code,409,"Não foi possível movimentar os Croins. Confira o saldo e tente novamente.");
    throw error;
  } finally { client.release(); }
}
async function read<T>(pool: Pool, action: (client: PoolClient) => Promise<T>) {
  const client=await pool.connect();
  try { await client.query("begin isolation level repeatable read read only"); const result=await action(client); await client.query("commit"); return result; }
  catch(error) { await client.query("rollback"); throw error; } finally { client.release(); }
}
export async function listLobbies(pool: Pool, actor: string | null) {
  return read(pool,async client => {
    const result=await client.query<Row>(`select m.* from game_matches m join games g on g.id=m.game_id where m.status='lobby' and not m.development and g.enabled=true order by m.created_at desc,m.id limit 100`);
    const joined=await client.query<Row>(`select m.* from game_matches m where m.status='lobby' and not m.development and (m.owner_id=$1 or exists(select 1 from game_match_players p where p.match_id=m.id and p.user_id=$1)) order by m.created_at desc,m.id`,[actor]);
    const active=await client.query<Row>(`select m.* from game_matches m where m.status='playing' and not m.development and exists(select 1 from game_match_players p where p.match_id=m.id and p.controller_id=$1) order by m.created_at,m.id limit 1`,[actor]);
    const all=[...result.rows,...joined.rows,...active.rows];
    const people=await participants(client,all.map(row=>row.id));
    const rooms=new Map<string,GameRoom>();
    for(const row of all)if(!rooms.has(row.id))rooms.set(row.id,await roomView(client,row,people.get(row.id) ?? []));
    const owned=joined.rows.find(row=>row.created_by===actor && row.owner_id===actor);
    const testRows=actor?(await client.query<Row>("select m.* from game_matches m where m.development and m.status='lobby' and (m.owner_id=$1 or exists(select 1 from game_match_players p where p.match_id=m.id and p.user_id=$1)) order by m.created_at desc limit 100",[actor])).rows:[];
    const testPeople=await participants(client,testRows.map(r=>r.id));
    const testLobbies=[];for(const row of testRows)testLobbies.push(await roomView(client,row,testPeople.get(row.id) ?? []));
    const running=actor?(await client.query<Row>("select m.* from game_matches m where m.development and m.status='playing' and (m.owner_id=$1 or exists(select 1 from game_match_players p where p.match_id=m.id and p.user_id=$1)) order by m.created_at desc limit 100",[actor])).rows:[];
    const runningPeople=await participants(client,running.map(r=>r.id));
    const testMatches=running.map(row=>({development:true,bots:row.bots,onlyBots:row.only_bots,id:row.id,code:row.code,game:row.game_slug,hostId:row.owner_id,rulesVersion:row.rules_version,version:row.version,capacity:row.capacity,options:row.options,entryAmount:0,status:"playing",round:(row.state as {round:number}).round,controllerIds:[],participants:runningPeople.get(row.id) ?? []}));
    const tests=actor?(await client.query(`select m.owner_id as "hostId",m.code,m.game_slug as game,m.status from game_matches m where m.development and m.status in ('lobby','playing') and (m.owner_id=$1 or exists(select 1 from game_match_players p where p.match_id=m.id and p.user_id=$1)) order by m.created_at desc limit 100`,[actor])).rows:[];
    return lobbyListSchema.parse({ ownedLobbies:joined.rows.filter(row=>row.created_by===actor && row.owner_id===actor).map(row=>rooms.get(row.id)),testMatches,testLobbies,tests,items:result.rows.map(row=>rooms.get(row.id)), joined:joined.rows.map(row=>rooms.get(row.id)), owned:owned?rooms.get(owned.id):null, active:active.rows[0]?rooms.get(active.rows[0].id):null });
  });
}
async function requireAvailable(client: PoolClient, actors: string[], game: string, development=false) {
  if(development)return;
  const active=await client.query(`select 1 from game_match_players p join game_matches m on m.id=p.match_id where p.controller_id=any($1::uuid[]) and m.status='playing' and m.development=$2 and m.game_slug=$3 limit 1`,[actors,development,game]);
  if(active.rows.length)throw new MatchError("ALREADY_PLAYING",409,"Há uma partida deste jogo em andamento. Conclua ou abandone antes de entrar em outra.");
}
async function leaveOtherLobbies(client: PoolClient, winner: string, actors: string[], game: string) {
  const others=await client.query<Row>(`select m.* from game_matches m where m.status='lobby' and not m.development and m.id<>$1 and m.game_slug=$3 and (
    exists(select 1 from game_match_players p where p.match_id=m.id and p.user_id=any($2::uuid[])) or
    exists(select 1 from game_match_invitations i where i.match_id=m.id and i.recipient_id=any($2::uuid[]))) order by m.id for update`,[winner,actors,game]);
  for(const room of others.rows){
    await client.query("delete from game_match_players where match_id=$1 and user_id=any($2::uuid[])",[room.id,actors]);
    await client.query("delete from game_match_invitations where match_id=$1 and recipient_id=any($2::uuid[])",[room.id,actors]);
    await client.query("delete from match_presence where match_id=$1 and user_id=any($2::uuid[])",[room.id,actors]);
    const remaining=(await participants(client,[room.id])).get(room.id) ?? [];
    const owner=remaining.some(person=>person.userId===room.owner_id)?room.owner_id:remaining[0]?.userId ?? room.owner_id;
    if(!remaining.length){
      await client.query("delete from game_match_invitations where match_id=$1",[room.id]);
      await client.query("delete from match_presence where match_id=$1",[room.id]);
    }
    await client.query("update game_matches set owner_id=$2,status=$3,version=version+1,updated_at=clock_timestamp() where id=$1",[room.id,owner,remaining.length?"lobby":"abandoned"]);
  }
}
export async function listMatches(pool: Pool, _actor: string | null) {
  // Public listing is independent of the caller's participation.
  void _actor;
  return read(pool,async client=>{
    const rows=await client.query<Omit<Row, "state"> & { round: number; controller_ids: string[] }>(`select m.id,m.code,m.game_slug,m.owner_id,m.rules_version,m.version,m.capacity,m.options,m.entry_amount,
      (m.state->>'round')::int as round,
      array(select p.controller_id from game_match_players p where p.match_id=m.id and p.controller_id is not null order by p.seat) as controller_ids
      from game_matches m where m.status='playing' and not m.development order by m.updated_at desc,m.id limit 100`);
    const people=await participants(client,rows.rows.map(row=>row.id));
    return matchListSchema.parse({ items:rows.rows.map(row=>({
      id:row.id,code:row.code,game:row.game_slug,hostId:row.owner_id,rulesVersion:row.rules_version,
      entryAmount:Number(row.entry_amount),version:row.version,capacity:row.capacity,options:row.options,status:"playing",round:row.round,
      controllerIds:row.controller_ids,participants:people.get(row.id) ?? [],
    })) });
  });
}
/** Account-only navigation data: never send cards, legal actions or private state. */
export async function listPersonalMatches(pool: Pool, actor: string) {
  return read(pool, async client => {
    const rows = await client.query<Row & { game_name: string; seat: number | null; controller_id: string | null }>(`
      select m.*,g.name as game_name,p.seat,p.controller_id
      from game_matches m join games g on g.id=m.game_id
      left join game_match_players p on p.match_id=m.id and p.user_id=$1
      where m.status in ('lobby','playing') and
        (p.controller_id=$1 or (m.owner_id=$1 and (m.status='lobby' or m.only_bots)))
      order by m.created_at,m.id`, [actor]);
    const people = await participants(client, rows.rows.map(row => row.id));
    return personalMatchesSchema.parse({ items: rows.rows.map(row => {
      const members = people.get(row.id) ?? [];
      const players = row.status === "playing"
        ? resolveDriver(row).summarize(resolveDriver(row).projectFor(row.state, null))
        : [...members.map(person => ({ name:person.displayName || person.username, bot:false })),
          ...Array.from({ length:row.bots ?? 0 }, (_, index) => ({ name:`Bot ${index+1}`, bot:true }))];
      const emptySeats = Array.from({ length:12 }, (_, seat) => seat).filter(seat => !members.some(person => person.seat === seat));
      const roster = players.map((player, seat) => {
        const member = row.status === "lobby" ? members[seat] : members.find(person => person.seat === seat);
        return { userId:member?.userId ?? null, seat:member?.seat ?? (row.status === "lobby" ? emptySeats[seat-members.length] : seat), username:member?.username ?? player.name,
          displayName:member?.displayName || player.name, avatarUrl:member?.avatarUrl ?? null, bot:player.bot };
      });
      let yourTurn = false;
      let turnKey: string | null = null;
      if (row.status === 'playing' && row.controller_id === actor && row.seat !== null && !row.only_bots) {
        const decision=resolveDriver(row).decision(row.state);
        yourTurn=decision?.seat===row.seat;
        if(yourTurn)turnKey=decision!.key;
      }
      return { code: row.code, game: row.game_slug, gameName: row.game_name, status: row.status,
        development: row.development, lobbyExpiresAt:row.status==="lobby" && !row.development && row.owner_id===actor?row.lobby_expires_at.toISOString():null, yourTurn, turnKey, participants: roster };
    }) });
  });
}
export async function getRoomSync(pool: Pool, actor: string | null, code: string, afterVersion=0) {
  return read(pool,async client=>{
    const found=await client.query<Row>("select * from game_matches where code=$1",[code]); const row=found.rows[0];
    if(!row || (row.status==="abandoned" && row.state===null)) throw new MatchError("NOT_FOUND",404,"Sala encerrada ou não encontrada.");
    await authorizeTest(client,row,actor);
    const people=(await participants(client,[row.id])).get(row.id) ?? [];
    const driver=resolveDriver(row);
    const member=people.find(p=>p.userId===actor);
    const seat=member && row.state!==null && driver.human(row.state,member.seat)?member.seat:null;
    const room=await roomView(client,row,people,seat);
    if(driver.snapshotOnly)return gameRoomSyncSchema.parse({room,frames:[],reset:true});
    if(room.status==="lobby" || afterVersion===0 || afterVersion>row.version) return gameRoomSyncSchema.parse({ room,frames:[],reset:true });
    const events=await client.query<{ event: unknown }>("select event from game_match_events where match_id=$1 and version>$2 and version<=$3 order by version limit 1001",[row.id,afterVersion,row.version]);
    const frames=events.rows.map(event=>event.event);
    const parsed=gameRoomSyncSchema.parse({ room,frames,reset:false });
    const continuous=parsed.frames.every((frame,index)=>frame.version===afterVersion+index+1) && afterVersion+parsed.frames.length===row.version && parsed.frames.length<=1000;
    return continuous ? parsed : gameRoomSyncSchema.parse({ room,frames:[],reset:true });
  });
}
export async function getMatch(pool: Pool, actor: string | null, code: string) {
  const room=(await getRoomSync(pool,actor,code)).room;
  if(room.status==="abandoned")throw new MatchError("NOT_FOUND",404,"Partida encerrada.");
  return room;
}
export async function createMatch(pool: Pool, actor: string, sessionHash: string, input: CreateMatch) {
  input=createMatchSchema.parse(input);
  return transaction(pool,actor,sessionHash,async(client,username)=>{
    if(input.development)await requireAdmin(client,actor);
    const definition=gameDefinitions[input.game],driver=gameDriver(input.game);
    if(definition.developmentOnly && !input.development)throw new MatchError("DEVELOPMENT_ONLY",403,"Este jogo está disponível apenas para testes.");
    if(!input.development && (input.bots || input.onlyBots))throw new MatchError("INVALID_INPUT",400,"Bots de teste exigem uma partida de teste.");
    if(input.development && input.entryAmount)throw new MatchError("TEST_ECONOMY",400,"Partidas de teste não movimentam Croins.");
    const max=definition.maxPlayers(input.options);
    if(input.capacity>max || input.bots+(input.onlyBots?0:1)>input.capacity || (input.onlyBots && input.bots<2))throw new MatchError("INVALID_INPUT",400,"Confira a quantidade de jogadores e bots.");
    definition.options.parse(input.options);
    if(input.entryAmount && !definition.croins)throw new MatchError("ECONOMY_UNAVAILABLE",400,"Este jogo não aceita Croins.");
    const payloadHash=hash(input);
    const previous=await client.query("select creation_hash,creation_response from game_matches where created_by=$1 and creation_request_id=$2",[actor,input.requestId]);
    if(previous.rows[0]) {
      if(previous.rows[0].creation_hash!==payloadHash) throw new MatchError("IDEMPOTENCY_CONFLICT",409,"Este pedido já foi usado com outra configuração.");
      return lobbySchema.parse(previous.rows[0].creation_response);
    }
    await requireAvailable(client,[actor],input.game,input.development);
    if(!input.development){
      const owned=await client.query("select 1 from game_matches m where not m.development and m.status in ('lobby','playing') and m.game_slug=$2 and ((m.created_by=$1 and m.owner_id=$1) or (m.status='playing' and exists(select 1 from game_match_players p where p.match_id=m.id and p.controller_id=$1))) limit 1",[actor,input.game]);
      if(owned.rows.length)throw new MatchError("LOBBY_EXISTS",409,"Você já tem uma sala deste jogo. Conclua ou encerre antes de criar outra.");
    }
    const catalog=await client.query("select id from games where slug=$1 and enabled=true for share",[input.game]);
    if(!catalog.rows[0]) throw new MatchError("NOT_FOUND",404,"Jogo indisponível.");
    const id=randomUUID(),code=randomBytes(6).toString("hex").toUpperCase();
    const account=await client.query("select display_name,avatar_key from users where id=$1",[actor]);
    const host={ userId:actor,username,displayName:account.rows[0].display_name,avatarUrl:avatarUrl(account.rows[0].avatar_key),seat:0 };
    const response=lobbySchema.parse({ development:input.development,bots:input.bots,onlyBots:input.onlyBots, confirmedUserIds:input.entryAmount>0?[actor]:[],entryAmount:input.entryAmount ?? 0,id,code,game:input.game,rulesVersion:driver.rulesVersion,version:1,status:"lobby",state:null,hostId:actor,capacity:input.capacity,options:input.options,participants:input.onlyBots?[]:[host] });
    await client.query(`insert into game_matches(id,code,game_id,game_slug,owner_id,created_by,rules_version,version,status,state,capacity,options,creation_request_id,creation_hash,creation_response,entry_amount,development,bots,only_bots) values($1,$2,$3,$4,$5,$5,$6,1,'lobby',null,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,[id,code,catalog.rows[0].id,input.game,actor,driver.rulesVersion,input.capacity,JSON.stringify(input.options),input.requestId,payloadHash,JSON.stringify(response),input.entryAmount ?? 0,input.development,input.bots,input.onlyBots]);
    if(input.onlyBots)await client.query("select pg_notify('croebet_matches',$1)",[JSON.stringify({kind:"account",userId:actor})]);
    if(!input.onlyBots)await client.query("insert into game_match_players(match_id,seat,user_id,controller_id,name,kind) values($1,0,$2,$2,$3,'user')",[id,actor,username]);
    return response;
  }, true);
}
async function recordFrames(client: PoolClient, id: string, frames: Frame[]) {
  for(const frame of frames) await client.query("insert into game_match_events(match_id,version,event) values($1,$2,$3)",[id,frame.version,JSON.stringify(frame)]);
}
async function replaceParticipant(client: PoolClient, row: Row, people: MatchParticipant[], seat: number) {
  const driver=resolveDriver(row);
  const before=driver.project(driver.parse(row.state));
  const state=driver.replace(driver.parse(row.state),seat);
  const version=row.version+1;
  const replacement: Frame={action:{type:"replace",seat},state:driver.project(state),version};
  await client.query("update game_match_players set controller_id=null,kind='bot' where match_id=$1 and seat=$2",[row.id,seat]);
  const humans=people.filter(person=>driver.human(state,person.seat));
  if(!humans.some(person=>person.userId===row.owner_id) && humans.length)row.owner_id=humans[0].userId;
  // Development bots finish automatically even after the last human leaves.
  const result=humans.length || row.development ? execute(driver,state,version) : {state,version,frames:[],status:"abandoned" as const};
  return {...result,before,frames:[replacement,...result.frames.map(frame=>({...frame,action:driver.eventAction(frame.action)}))]};
}
export async function kickMatch(pool: Pool, actor: string, sessionHash: string, code: string, input: KickMatch) {
  return transaction(pool,actor,sessionHash,async client=>{
    const found=await client.query<Row>("select * from game_matches where code=$1 for update",[code]);const row=found.rows[0];
    if(!row)throw new MatchError("NOT_FOUND",404,"Sala não encontrada.");
    const driver=resolveDriver(row);
    if(!gameDefinitions[row.game_slug].kickDuringPlay && row.status!=="lobby")throw new MatchError("LOBBY_CLOSED",409,"Só é possível remover jogadores no lobby deste jogo.");
    const payloadHash=hash({actor,kind:"kick",input});
    const receipt=await client.query("select payload_hash,response from game_match_commands where match_id=$1 and actor_id=$2 and command_id=$3",[row.id,actor,input.commandId]);
    if(receipt.rows[0]){if(receipt.rows[0].payload_hash!==payloadHash)throw new MatchError("IDEMPOTENCY_CONFLICT",409,"Comando já utilizado.");return gameRoomSchema.parse(receipt.rows[0].response);}
    if(row.owner_id!==actor)throw new MatchError("HOST_ONLY",403,"Somente o host pode expulsar participantes.");
    if(row.version!==input.expectedVersion || !["lobby","playing"].includes(row.status))throw new MatchError("VERSION_CONFLICT",409,"A sala mudou. Confira os participantes e tente novamente.");
    const people=(await participants(client,[row.id])).get(row.id) ?? [];
    const target=people.find(person=>person.userId===input.targetUserId);
    const reserved=!target && row.status==="lobby" && (await reservations(client,row.id)).some(p=>p.userId===input.targetUserId);
    if((!target && !reserved) || input.targetUserId===actor)throw new MatchError("INVALID_TARGET",409,"Escolha outro participante da sala.");
    let currentPeople=people;
    if(row.status==="lobby"){
      await client.query("delete from game_match_invitations where match_id=$1 and recipient_id=$2",[row.id,input.targetUserId]);
      await client.query("delete from game_match_players where match_id=$1 and user_id=$2",[row.id,input.targetUserId]);
      currentPeople=people.filter(person=>person.userId!==input.targetUserId);row.version++;
    }else{
      if(!target || !driver.human(row.state,target.seat))throw new MatchError("INVALID_TARGET",409,"Um bot já controla esta vaga.");
      const result=await replaceParticipant(client,row,people,target.seat);
      row.state=result.state;row.version=result.version;row.status=result.status;
      await recordFrames(client,row.id,result.frames);
    }
    await client.query("update game_matches set owner_id=$2,version=$3,status=$4,state=$5,updated_at=clock_timestamp() where id=$1",[row.id,row.owner_id,row.version,row.status,row.state===null?null:JSON.stringify(row.state)]);
    if(!row.development && row.state!==null)await settleMatch(client,row.id,row.code,row.status,driver.outcome(row.state));
    const response=await roomView(client,row,currentPeople);
    await client.query("insert into game_match_commands(match_id,actor_id,command_id,payload_hash,response) values($1,$2,$3,$4,$5)",[row.id,actor,input.commandId,payloadHash,JSON.stringify(response)]);
    return response;
  }, true);
}
export async function lobbyAction(pool: Pool, actor: string, sessionHash: string, code: string, kind: "join"|"leave"|"start"|"update"|"confirm-entry"|"keep-open", input: {commandId:string;expectedVersion?:number;entryAmount?:number} | UpdateLobby) {
  return transaction(pool,actor,sessionHash,async(client)=>{
    const found=await client.query<Row>("select * from game_matches where code=$1 for update",[code]); const row=found.rows[0];
    if(!row) throw new MatchError("NOT_FOUND",404,"Sala não encontrada.");
    const payloadHash=hash({actor,kind,input});
    const receipt=await client.query("select payload_hash,response from game_match_commands where match_id=$1 and actor_id=$2 and command_id=$3",[row.id,actor,input.commandId]);
    if(receipt.rows[0]) { if(receipt.rows[0].payload_hash!==payloadHash) throw new MatchError("IDEMPOTENCY_CONFLICT",409,"Comando já utilizado."); return lobbyActionResultSchema.parse(receipt.rows[0].response); }
    const driver=resolveDriver(row),definition=gameDefinitions[row.game_slug];
    if(row.status!=="lobby") throw new MatchError("LOBBY_CLOSED",409,"Esta sala não está mais aberta.");

    await client.query("delete from game_match_players where match_id=$1 and user_id is null",[row.id]);
    let people=(await participants(client,[row.id])).get(row.id) ?? [];
    const member=people.find(person=>person.userId===actor);
    if(row.development && ["start","update"].includes(kind))await requireAdmin(client,actor);
    if(!row.development && row.lobby_expires_at.getTime()<=Date.now() && kind!=="leave")throw new MatchError("LOBBY_CLOSED",409,"Este lobby expirou. Crie uma nova sala.");
    if(kind==="keep-open") {
      if(row.owner_id!==actor)throw new MatchError("HOST_ONLY",403,"Somente o host pode manter a sala aberta.");
      const renewed=await client.query<{lobby_expires_at:Date}>("update game_matches set lobby_expires_at=clock_timestamp()+interval '32 minutes' where id=$1 returning lobby_expires_at",[row.id]);
      row.lobby_expires_at=renewed.rows[0].lobby_expires_at; row.version++;
    } else if(kind==="join") {
      await authorizeTest(client,row,actor);
      if(row.development && row.only_bots)throw new MatchError("TEST_BOTS_ONLY",403,"Esta partida é apenas de bots.");
      const enabled=await client.query("select 1 from games where id=$1 and enabled=true for share",[row.game_id]);
      if(!enabled.rows[0]) throw new MatchError("NOT_FOUND",404,"Jogo indisponível.");
      if(!member) {
        await requireAvailable(client,[actor],row.game_slug,row.development);
        if(people.length+(row.bots ?? 0)+(await reservations(client,row.id)).filter(p=>p.userId!==actor).length>=row.capacity) throw new MatchError("LOBBY_FULL",409,"Esta sala está lotada.");
        const seat=Array.from({length:row.capacity},(_,i)=>i).find(index=>!people.some(person=>person.seat===index))!;
        await client.query("insert into game_match_players(match_id,seat,user_id,controller_id,name,kind,confirmed_entry_amount) select $1,$2,id,id,username,'user',nullif($4::bigint,0) from users where id=$3",[row.id,seat,actor,row.entry_amount]);
        row.version++;
      }
      await client.query("delete from game_match_invitations where match_id=$1 and recipient_id=$2",[row.id,actor]);
    } else if(kind==="confirm-entry") {
      if(!member)throw new MatchError("NOT_A_PARTICIPANT",403,"Entre na sala para confirmar a entrada.");
      if(row.version!==input.expectedVersion || Number(row.entry_amount)!==input.entryAmount || !input.entryAmount)throw new MatchError("VERSION_CONFLICT",409,"O valor ou a sala mudou. Confira e confirme novamente.");
      await client.query("update game_match_players set confirmed_entry_amount=$3 where match_id=$1 and user_id=$2",[row.id,actor,input.entryAmount]);
      row.version++;
    } else if(kind==="leave") {
      if(!member && !(row.development && row.owner_id===actor)) throw new MatchError("NOT_FOUND",404,"Você não está nesta sala.");
      await client.query("delete from game_match_players where match_id=$1 and user_id=$2",[row.id,actor]);
      people=people.filter(person=>person.userId!==actor); row.version++;
      if(!people.length || (row.development && row.owner_id===actor)) row.status="abandoned";
      else if(row.owner_id===actor) row.owner_id=people[0].userId;
    } else if (kind==="update") {
      if(row.owner_id!==actor) throw new MatchError("HOST_ONLY",403,"Somente o host pode alterar a sala.");
      const settings=updateLobbySchema.parse(input);
      if(row.version!==settings.expectedVersion) throw new MatchError("VERSION_CONFLICT",409,"A sala mudou. Confira os participantes e tente novamente.");
      if(Number(row.entry_amount)!==settings.entryAmount)await client.query("update game_match_players set confirmed_entry_amount=$2 where match_id=$1",[row.id,settings.entryAmount>0 && settings.entryAmount<Number(row.entry_amount)?settings.entryAmount:null]);
      if(row.development && settings.entryAmount)throw new MatchError("TEST_ECONOMY",400,"Partidas de teste não movimentam Croins.");
      definition.options.parse(settings.options);
      if(settings.capacity>definition.maxPlayers(settings.options))throw new MatchError("INVALID_INPUT",400,"Quantidade inválida para este modo.");
      if(settings.entryAmount && !definition.croins)throw new MatchError("ECONOMY_UNAVAILABLE",400,"Este jogo não aceita Croins.");
      const invited=await reservations(client,row.id);
      // Match the lobby's order (people, invitations, bots), always retaining
      // the host even if ownership changed after the original host left.
      const retained=[...people.filter(person=>person.userId===row.owner_id),...people.filter(person=>person.userId!==row.owner_id)].slice(0,settings.capacity);
      const removed=people.filter(person=>!retained.some(kept=>kept.userId===person.userId)).map(person=>person.userId);
      const retainedInvitations=invited.slice(0,settings.capacity-retained.length);
      const removedInvitations=invited.slice(retainedInvitations.length).map(person=>person.userId);
      if(removed.length)await client.query("delete from game_match_players where match_id=$1 and user_id=any($2::uuid[])",[row.id,removed]);
      if(removed.length || removedInvitations.length)await client.query("delete from game_match_invitations where match_id=$1 and recipient_id=any($2::uuid[])",[row.id,[...removed,...removedInvitations]]);
      if(settings.capacity<row.capacity && people.length){
        const keptIds=people.filter(person=>!removed.includes(person.userId)).map(person=>person.userId);
        // Move out of the occupied range before compacting to avoid unique-seat
        // collisions when earlier departures left gaps in the lobby.
        await client.query("update game_match_players set seat=seat+$2 where match_id=$1",[row.id,Math.max(...people.map(person=>person.seat))+1]);
        await client.query("update game_match_players p set seat=kept.position-1 from unnest($2::uuid[]) with ordinality as kept(user_id,position) where p.match_id=$1 and p.user_id=kept.user_id",[row.id,keptIds]);
      }
      row.bots=Math.min(row.bots,settings.capacity-retained.length-retainedInvitations.length);
      row.entry_amount=String(settings.entryAmount);
      row.capacity=settings.capacity; row.options=settings.options; row.version++;
    } else {
      if(row.owner_id!==actor) throw new MatchError("HOST_ONLY",403,"Somente o host pode iniciar a partida.");
      if(row.version!==input.expectedVersion) throw new MatchError("VERSION_CONFLICT",409,"A sala mudou. Confira os participantes e tente novamente.");
      if(people.length+(row.bots ?? 0)<2) throw new MatchError("NOT_ENOUGH_PLAYERS",409,"Aguarde pelo menos mais uma pessoa.");
      if((await reservations(client,row.id)).length)throw new MatchError("INVITATIONS_PENDING",409,"Aguarde todos os convidados entrarem ou remova suas vagas.");
      const online=await client.query("select count(distinct user_id)::int total from match_presence where match_id=$1 and expires_at>clock_timestamp() and user_id=any($2::uuid[])",[row.id,people.map(p=>p.userId)]);
      if(online.rows[0].total!==people.length)throw new MatchError("PLAYERS_OFFLINE",409,"Todos os participantes precisam estar online na sala para iniciar.");
      const ready=await client.query("select count(*)::int as total from game_match_players p join users u on u.id=p.user_id and u.status='active' where p.match_id=$1",[row.id]);
      if(ready.rows[0].total!==people.length) throw new MatchError("PLAYER_UNAVAILABLE",409,"Há um participante indisponível nesta sala.");
      const enabled=await client.query("select 1 from games where id=$1 and enabled=true for share",[row.game_id]);
      if(!enabled.rows[0]) throw new MatchError("NOT_FOUND",404,"Jogo indisponível.");
      if(Number(row.entry_amount)>0){
        const confirmed=await client.query("select count(*)::int total from game_match_players where match_id=$1 and (confirmed_entry_amount=$2 or user_id=$3)",[row.id,row.entry_amount,row.owner_id]);
        if(confirmed.rows[0].total!==people.length)throw new MatchError("ENTRY_NOT_CONFIRMED",409,"Todos os participantes precisam confirmar o valor da entrada.");
      }
      await requireAvailable(client,people.map(person=>person.userId),row.game_slug,row.development);
      if(!row.development)await leaveOtherLobbies(client,row.id,people.map(person=>person.userId),row.game_slug);
      await client.query("update game_match_players set seat=seat+100 where match_id=$1",[row.id]);
      for(const [index,person] of people.entries()) { await client.query("update game_match_players set seat=$3 where match_id=$1 and user_id=$2",[row.id,person.userId,index]); person.seat=index; }
      if(!row.development)await fundMatch(client,row.id,row.code,Number(row.entry_amount),people);
      const initial=driver.create({onlyBots:row.only_bots,setup:[...people.map(person=>({name:person.displayName || person.username,kind:"human" as const})),...Array.from({length:row.bots ?? 0},(_,i)=>({name:`Bot ${i+1}`,kind:"normal" as const}))],options:row.options},people[0]?.displayName || people[0]?.username || "Observador");
      const result=row.only_bots?{state:initial,before:driver.project(initial),version:row.version+1,status:"playing" as const,frames:[]}:execute(driver,initial,row.version+1);
      row.state=result.state; row.version=result.version; row.status=result.status;
      await recordFrames(client,row.id,[{action:{type:"start"},state:result.before,version:result.frames[0]?.version ? result.frames[0].version-1 : row.version},...result.frames.map(frame=>({...frame,action:driver.eventAction(frame.action)}))]);
    }
    await client.query("update game_matches set owner_id=$2,version=$3,status=$4,state=$5,capacity=$6,options=$7,entry_amount=$8,bots=$9,updated_at=clock_timestamp() where id=$1",[row.id,row.owner_id,row.version,row.status,row.state===null?null:JSON.stringify(row.state),row.capacity,JSON.stringify(row.options),row.entry_amount,row.bots]);
    if(!row.development && row.state!==null)await settleMatch(client,row.id,row.code,row.status,driver.outcome(row.state));
    const currentPeople=(await participants(client,[row.id])).get(row.id) ?? [];
    const response=row.status==="abandoned" ? {code:row.code,status:"closed"} : await roomView(client,row,currentPeople);
    await client.query("insert into game_match_commands(match_id,actor_id,command_id,payload_hash,response) values($1,$2,$3,$4,$5)",[row.id,actor,input.commandId,payloadHash,JSON.stringify(response)]);
    return response;
  }, true);
}
export async function commandMatch(pool: Pool, actor: string, sessionHash: string, code: string, input: GameCommand | {commandId:string;expectedVersion:number}, abandon=false) {
  return transaction(pool,actor,sessionHash,async client=>{
    const found=await client.query<Row>("select * from game_matches where code=$1 for update",[code]); const row=found.rows[0];
    if(!row) throw new MatchError("NOT_FOUND",404,"Partida não encontrada.");
    const people=(await participants(client,[row.id])).get(row.id) ?? [];
    const member=people.find(person=>person.userId===actor);
    if(!member) throw new MatchError("NOT_FOUND",404,"Partida não encontrada.");
    const payloadHash=hash({actor,abandon,input});
    const receipt=await client.query("select payload_hash,response from game_match_commands where match_id=$1 and actor_id=$2 and command_id=$3",[row.id,actor,input.commandId]);
    if(receipt.rows[0]) { if(receipt.rows[0].payload_hash!==payloadHash) throw new MatchError("IDEMPOTENCY_CONFLICT",409,"Comando já utilizado."); return gameMatchResultSchema.parse(receipt.rows[0].response); }
    if(row.version!==input.expectedVersion || row.status!=="playing") throw new MatchError("VERSION_CONFLICT",409,"A partida mudou. Sincronize para continuar.");
    await authorizeTest(client,row,actor);
    const driver=resolveDriver(row);
    const state=driver.parse(row.state);
    if(!driver.human(state,member.seat))throw new MatchError("PARTICIPATION_ENDED",403,"Um bot já controla sua vaga.");
    if(!abandon) {
      const enabled=await client.query("select 1 from games where id=$1 and enabled=true for share",[row.game_id]);
      if(!enabled.rows[0]) throw new MatchError("NOT_FOUND",404,"Jogo indisponível.");
      const decision=driver.decision(state)?.seat;
      if(member.seat!==decision) throw new MatchError("NOT_YOUR_TURN",403,"Aguarde sua vez.");
    }
    const result=abandon ? await replaceParticipant(client,row,people,member.seat) : execute(driver,state,row.version,"action" in input?input.action:undefined);
    if(!row.development)await settleMatch(client,row.id,row.code,result.status,driver.outcome(result.state));
    const frames=result.frames.map(frame=>({...frame,action:frame.action.type==="replace" || frame.action.type==="start"?frame.action:driver.eventAction(frame.action)}));
    await recordFrames(client,row.id,frames);
    await client.query("update game_matches set state=$2,version=$3,status=$4,owner_id=$5,updated_at=clock_timestamp() where id=$1",[row.id,JSON.stringify(result.state),result.version,result.status,row.owner_id]);
    // The archive trigger records ended_at on update. Read the final projection
    // afterwards so the command receipt includes the same duration as a reload.
    const response=driver.snapshotOnly?{ok:true as const}:gameExecutionResultSchema.parse({match:await roomView(client,{...row,...result},people),before:result.before,frames});
    await client.query("insert into game_match_commands(match_id,actor_id,command_id,payload_hash,response) values($1,$2,$3,$4,$5)",[row.id,actor,input.commandId,payloadHash,JSON.stringify(response)]);
    return response;
  }, abandon);
}


/** A visible authenticated page renews a lease; an open login session alone is not online. */
export async function refreshPresence(pool: Pool, actor: string, sessionHash: string) {
  return transaction(pool, actor, sessionHash, async client => {
    await client.query(`insert into user_presence(user_id,expires_at) values($1,clock_timestamp()+interval '75 seconds')
      on conflict(user_id) do update set expires_at=excluded.expires_at`, [actor]);
    return readLobbyInvitations(client, actor);
  });
}
export async function readLobbyInvitations(client: Client, actor: string) {
  const result=await client.query<{code:string;game:string;game_name:string;development:boolean;username:string;avatar_key:string|null}>(`
    select m.code,m.game_slug as game,g.name as game_name,m.development,u.username,u.avatar_key from game_match_invitations i
    join game_matches m on m.id=i.match_id join games g on g.id=m.game_id join users u on u.id=i.sender_id
    where i.recipient_id=$1 and i.expires_at>clock_timestamp() and m.status='lobby' and g.enabled and u.status='active'
    and not exists(select 1 from game_match_players p where p.match_id=m.id and p.user_id=$1)
    order by i.expires_at desc,i.id limit 50`,[actor]);
  return lobbyInvitationsSchema.parse({items:result.rows.map(row=>({code:row.code,game:row.game,gameName:row.game_name,development:row.development,username:row.username,avatarUrl:avatarUrl(row.avatar_key)}))});
}

export async function listLobbyPlayers(pool: Pool, actor: string, code: string, q: string) {
  return read(pool, async client => {
    const room=await client.query("select m.id from game_matches m join games g on g.id=m.game_id where m.code=$1 and m.owner_id=$2 and m.status='lobby' and g.enabled",[code,actor]);
    if(!room.rows[0])throw new MatchError("HOST_ONLY",403,"Somente o host pode convidar para uma sala aberta.");
    const rows=await client.query<{id:string;username:string;avatar_key:string|null;online:boolean;invited:boolean}>(`
      select u.id,u.username,u.avatar_key,coalesce(p.expires_at>clock_timestamp(),false) as online,
        exists(select 1 from game_match_invitations i where i.match_id=$1 and i.recipient_id=u.id and i.expires_at>clock_timestamp()) as invited
      from users u left join user_presence p on p.user_id=u.id
      where u.status='active' and u.id<>$2 and strpos(lower(u.username),lower($3))>0
      and not exists(select 1 from game_match_players member where member.match_id=$1 and member.user_id=u.id)
      order by online desc,lower(u.username),u.id limit 101`,[room.rows[0].id,actor,q]);
    return lobbyPlayersSchema.parse({items:rows.rows.slice(0,100).map(row=>({userId:row.id,username:row.username,avatarUrl:avatarUrl(row.avatar_key),online:row.online,invited:row.invited})),hasMore:rows.rows.length>100});
  });
}
export async function inviteLobbyPlayer(pool: Pool, actor: string, sessionHash: string, code: string, target: string) {
  return transaction(pool, actor, sessionHash, async client => {
    const result=await client.query("select m.id,m.owner_id,m.status,m.capacity,m.development,m.bots,m.only_bots,g.enabled from game_matches m join games g on g.id=m.game_id where m.code=$1 for update of m",[code]);
    const room=result.rows[0];
    if(!room || room.status!=="lobby" || !room.enabled)throw new MatchError("LOBBY_CLOSED",409,"Esta sala não está aberta.");
    if(room.owner_id!==actor)throw new MatchError("HOST_ONLY",403,"Somente o host pode convidar.");
    if(room.development)await requireAdmin(client,actor);
    if(room.only_bots)throw new MatchError("TEST_BOTS_ONLY",409,"Esta partida é apenas de bots.");
    const members=await client.query("select user_id from game_match_players where match_id=$1",[room.id]);
    const reserved=await reservations(client,room.id);
    if(reserved.some(p=>p.userId===target))return {ok:true as const};
    if(members.rows.length+(room.bots ?? 0)+reserved.length>=room.capacity)throw new MatchError("LOBBY_FULL",409,"Esta sala está lotada.");
    if(target===actor || members.rows.some(p=>p.user_id===target))throw new MatchError("ALREADY_JOINED",409,"Esta pessoa já está na sala.");
    const recipient=await client.query("select 1 from users where id=$1 and status='active'",[target]);
    if(!recipient.rows.length)throw new MatchError("NOT_FOUND",404,"Usuário indisponível.");
    await client.query(`insert into game_match_invitations(match_id,sender_id,recipient_id,expires_at) values($1,$2,$3,clock_timestamp()+interval '1 day')
      on conflict(match_id,recipient_id) do update set sender_id=excluded.sender_id,expires_at=excluded.expires_at
      where game_match_invitations.expires_at<=clock_timestamp()`,[room.id,actor,target]);
    await client.query("update game_matches set version=version+1 where id=$1",[room.id]);
    return {ok:true as const};
  }, true);
}

export async function declineInvitation(pool: Pool, actor: string, sessionHash: string, code: string) {
  return transaction(pool,actor,sessionHash,async client=>{
    const room=await client.query("select id from game_matches where code=$1 and status='lobby' for update",[code]);
    if(room.rows[0]){
      const removed=await client.query("delete from game_match_invitations where match_id=$1 and recipient_id=$2 returning id",[room.rows[0].id,actor]);
      if(removed.rowCount)await client.query("update game_matches set version=version+1 where id=$1",[room.rows[0].id]);
    }
    return {ok:true as const};
  }, true);
}

async function requireAdmin(client:Client,actor:string){
 const user=await client.query("select 1 from users where id=$1 and role='admin' and status='active'",[actor]);
 if(!user.rows.length)throw new MatchError("ADMIN_ONLY",403,"Somente administradores podem criar e iniciar testes.");
}
async function authorizeTest(client:Client,row:Row,actor:string|null){
 if(!row.development)return;
 if(!actor)throw new MatchError("NOT_FOUND",404,"Sala não encontrada.");
 const allowed=await client.query(`select 1 where $1::uuid=$2::uuid or exists(select 1 from game_match_players where match_id=$3 and user_id=$1) or exists(select 1 from game_match_invitations where match_id=$3 and recipient_id=$1 and expires_at>clock_timestamp())`,[actor,row.owner_id,row.id]);
 if(!allowed.rows.length)throw new MatchError("NOT_FOUND",404,"Sala não encontrada.");
}
export async function stepTest(pool:Pool,actor:string,sessionHash:string,code:string,input:{commandId:string;expectedVersion:number}){
 return transaction(pool,actor,sessionHash,async client=>{
 await requireAdmin(client,actor);
 const found=await client.query<Row>("select * from game_matches where code=$1 for update",[code]);const row=found.rows[0];
 if(!row || !row.development || !row.only_bots || row.owner_id!==actor)throw new MatchError("NOT_FOUND",404,"Teste não encontrado.");
 const digest=hash({kind:"test-step",input});const receipt=await client.query("select payload_hash from game_match_commands where match_id=$1 and actor_id=$2 and command_id=$3",[row.id,actor,input.commandId]);
 if(receipt.rows[0]){if(receipt.rows[0].payload_hash!==digest)throw new MatchError("IDEMPOTENCY_CONFLICT",409,"Comando já usado.");return {ok:true as const};}
 if(row.status!=="playing" || row.version!==input.expectedVersion)throw new MatchError("VERSION_CONFLICT",409,"A partida mudou.");
 const driver=resolveDriver(row),current=driver.parse(row.state),action=driver.automatic(current);
 if(!action)throw new MatchError("NO_AUTOMATION",409,"Não há jogada automática.");
 const state=driver.apply(current,action),finished=driver.finished(state);
 driver.parse(state);
 await recordFrames(client,row.id,[{action:driver.eventAction(action),state:driver.project(state),version:row.version+1}]);
 await client.query("update game_matches set state=$2,status=$3,version=version+1,updated_at=clock_timestamp() where id=$1",[row.id,JSON.stringify(state),finished?"finished":"playing"]);
 await client.query("insert into game_match_commands(match_id,actor_id,command_id,payload_hash,response) values($1,$2,$3,$4,$5)",[row.id,actor,input.commandId,digest,JSON.stringify({ok:true})]);
 return {ok:true as const};
 });
}

export async function endTest(pool:Pool,actor:string,sessionHash:string,code:string,input:{commandId:string;expectedVersion:number}){
 return transaction(pool,actor,sessionHash,async client=>{
 await requireAdmin(client,actor);
 const found=await client.query<Row>("select * from game_matches where code=$1 for update",[code]);const row=found.rows[0];
 if(!row || !row.development || row.owner_id!==actor)throw new MatchError("NOT_FOUND",404,"Teste não encontrado.");
 if(row.status==="abandoned")return {ok:true as const};
 if(row.status==="finished")throw new MatchError("MATCH_FINISHED",409,"A partida já terminou.");
 if(row.version!==input.expectedVersion)throw new MatchError("VERSION_CONFLICT",409,"A partida mudou.");
 await client.query("update game_matches set status='abandoned',version=version+1,updated_at=clock_timestamp() where id=$1",[row.id]);
 return {ok:true as const};
 },true);
}

async function readCancellation(client:Client,matchId:string){
 const row=(await client.query("select * from game_match_cancellations where match_id=$1 and status='pending'",[matchId])).rows[0];
 return row?cancellationProposalSchema.parse({id:row.id,proposedBy:row.proposed_by,eligibleUserIds:row.eligible_user_ids,acceptedUserIds:row.accepted_user_ids,createdAt:row.created_at.toISOString()}):null;
}
export async function collectiveCancellation(pool:Pool,actor:string,sessionHash:string,code:string,input:{commandId:string;expectedVersion:number;proposalId?:string;accept?:boolean}){
 return transaction(pool,actor,sessionHash,async client=>{
 const found=await client.query<Row>("select * from game_matches where code=$1 for update",[code]),row=found.rows[0];
 if(!row)throw new MatchError("NOT_FOUND",404,"Partida não encontrada.");
 if(row.development)throw new MatchError("DEVELOPMENT_CANCELLATION",409,"Partidas de desenvolvimento usam cancelamento direto pelo administrador da sala.");
 const digest=hash({kind:"collective-cancellation",input});
 const receipt=await client.query("select payload_hash,response from game_match_commands where match_id=$1 and actor_id=$2 and command_id=$3",[row.id,actor,input.commandId]);
 if(receipt.rows[0]){if(receipt.rows[0].payload_hash!==digest)throw new MatchError("IDEMPOTENCY_CONFLICT",409,"Comando já utilizado.");return {ok:true as const};}
 if(row.status!=="playing" || row.version!==input.expectedVersion)throw new MatchError("VERSION_CONFLICT",409,"A partida mudou. Tente novamente.");
 const controlled=await client.query<{controller_id:string}>("select controller_id from game_match_players where match_id=$1 and controller_id is not null order by seat",[row.id]);
 const eligible=controlled.rows.map(p=>p.controller_id);
 if(!eligible.includes(actor))throw new MatchError("NOT_A_PARTICIPANT",403,"Somente jogadores na partida podem propor ou votar.");
 let proposal=await readCancellation(client,row.id);
 if(!input.proposalId){
  if(proposal)throw new MatchError("PROPOSAL_EXISTS",409,"Já existe uma proposta em votação.");
  const id=randomUUID();
  await client.query("insert into game_match_cancellations(id,match_id,code,proposed_by,eligible_user_ids,accepted_user_ids) values($1,$2,$3,$4,$5,$6)",[id,row.id,row.code,actor,JSON.stringify(eligible),JSON.stringify([actor])]);
  proposal={id,proposedBy:actor,eligibleUserIds:eligible,acceptedUserIds:[actor],createdAt:new Date().toISOString()};
 }else{
  if(!proposal || proposal.id!==input.proposalId)throw new MatchError("PROPOSAL_CLOSED",409,"Esta proposta não está mais em votação.");
  if(!proposal.eligibleUserIds.includes(actor))throw new MatchError("NOT_ELIGIBLE",403,"Você não participa desta votação.");
  if(input.accept===false){await client.query("update game_match_cancellations set status='rejected',resolved_at=clock_timestamp() where id=$1",[proposal.id]);proposal=null;}
  else if(!proposal.acceptedUserIds.includes(actor)){proposal.acceptedUserIds.push(actor);await client.query("update game_match_cancellations set accepted_user_ids=$2 where id=$1",[proposal.id,JSON.stringify(proposal.acceptedUserIds)]);}
 }
 const approved=proposal?.eligibleUserIds.every(id=>proposal?.acceptedUserIds.includes(id)) ?? false;
 if(approved && proposal){
  if(!row.development)await refundCollectiveMatch(client,row.id,row.code);
  await client.query("update game_match_cancellations set status='accepted',resolved_at=clock_timestamp() where id=$1",[proposal.id]);
 }
 await client.query("update game_matches set status=$2,version=version+1,updated_at=clock_timestamp() where id=$1",[row.id,approved?"abandoned":"playing"]);
 await client.query("insert into game_match_commands(match_id,actor_id,command_id,payload_hash,response) values($1,$2,$3,$4,$5)",[row.id,actor,input.commandId,digest,JSON.stringify({ok:true})]);
 return {ok:true as const};
 },true);
}
// Compatibility aliases for clients already open during deployment.
export const commandLove = (pool:Pool,actor:string,session:string,code:string,input:GameCommand)=>commandMatch(pool,actor,session,code,input).then(()=>({ok:true as const}));
export const abandonLove = (pool:Pool,actor:string,session:string,code:string,input:{commandId:string;expectedVersion:number})=>commandMatch(pool,actor,session,code,input,true).then(()=>({ok:true as const}));

/** A short server lease prevents a closed tab from accumulating playback time forever. */
export async function trackTestPlayback(pool:Pool,actor:string,sessionHash:string,code:string,running:boolean) {
 return transaction(pool,actor,sessionHash,async client=>{
  await requireAdmin(client,actor);
  const found=await client.query<Row>("select * from game_matches where code=$1 for update",[code]);
  const row=found.rows[0];
  if(!row || !row.development || !row.only_bots || row.owner_id!==actor)throw new MatchError("NOT_FOUND",404,"Teste não encontrado.");
  if(row.status!=="playing")return {ok:true as const};
  await client.query(`update game_matches set
    playback_milliseconds=playback_milliseconds+case when playback_since is null then 0 else greatest(0,floor(extract(epoch from (least(clock_timestamp(),playback_until)-playback_since))*1000))::bigint end,
    playback_since=case when $2 then clock_timestamp() end,
    playback_until=case when $2 then clock_timestamp()+interval '15 seconds' end where id=$1`,[row.id,running]);
  return {ok:true as const};
 });
}
