import "server-only";
import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { matchCodeSchema, gameRoomSchema, matchListSchema, lobbyListSchema, type GameRoom, type MatchSummary, type Lobby, type LobbyList, gameReplaySchema, type GameId } from "@croebet/shared";

export type InitialMatches = { replay?: ReturnType<typeof gameReplaySchema.parse>; revision: string; match: Exclude<GameRoom,{status:"lobby"}> | null; lobby: Lobby | null; directory: LobbyList; items: MatchSummary[]; error: string; unavailable: boolean };
export async function getInitialMatches(code: string | undefined, game?:GameId): Promise<InitialMatches> {
  const empty: InitialMatches = { revision: randomUUID(), match: null, lobby:null,directory:{items:[],joined:[],owned:null,active:null},items: [], error: "", unavailable: false };
  const jar=await cookies();
  const cookie=jar.get("__Host-croebet-session") ?? jar.get("croebet-session");
  if(code && !matchCodeSchema.safeParse(code).success)return {...empty,error:"Sala não encontrada."};
  const request=async(path:string)=>{
    const response=await fetch(`${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"}/api/v1/matches${path}`,{headers:cookie?{cookie:`${cookie.name}=${encodeURIComponent(cookie.value)}`} : {},cache:"no-store",redirect:"error",signal:AbortSignal.timeout(5000)});
    if(response.status===401)throw Error("Entre novamente para acessar as salas.");
    if(response.status===404)throw Error("Sala não encontrada.");
    if(!response.ok)throw Error("unavailable");
    return response.json();
  };
  try {
    if (code) {
      let room: GameRoom | null = null;
      try { room = gameRoomSchema.parse(await request(`/${code}`)); }
      catch (error) { if (!(error instanceof Error) || error.message !== "Sala não encontrada.") throw error; }
      if(room && game && room.game!==game)throw Error("Sala não encontrada.");
      if ((!room || room.status === "finished" || room.status === "abandoned") && cookie) {
        const response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"}/api/v1/me/matches/${code}?limit=100`, { headers: { cookie: `${cookie.name}=${encodeURIComponent(cookie.value)}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
        if (response.ok) return { ...empty, replay: gameReplaySchema.parse(await response.json()) };
        if (response.status !== 401 && response.status !== 404) throw Error("unavailable");
      }
      if (!room) throw Error("Sala não encontrada.");
      const directory = lobbyListSchema.parse(await request("/lobbies"));
      return room.status === "lobby" ? { ...empty, directory, lobby: room } : { ...empty, directory, match: room };
    }
    const [data,lobbies]=await Promise.all([request(""),request("/lobbies")]);
    const directory=lobbyListSchema.parse(lobbies);
    return {...empty,directory,lobby:directory.owned,items:matchListSchema.parse(data).items};
  }catch(error){const message=error instanceof Error?error.message:"unavailable";return {...empty,unavailable:message==="unavailable" || !["Entre novamente para acessar as salas.","Sala não encontrada."].includes(message),error:message==="unavailable"?"Não foi possível carregar as salas.":message};}
}

/** Resolve development links before rendering, including public spectator views. */
export async function getInitialTestRoom(code: string): Promise<GameRoom | null> {
  const jar = await cookies();
  const cookie = jar.get("__Host-croebet-session") ?? jar.get("croebet-session");
  let response: Response;
  try {
    response = await fetch(`${process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001"}/api/v1/matches/${code}`, {
      headers: cookie ? { cookie: `${cookie.name}=${encodeURIComponent(cookie.value)}` } : {},
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000),
    });
  } catch { return null; }
  if (response.status === 401 || response.status === 404) notFound();
  if (!response.ok) return null;
  const parsed = gameRoomSchema.safeParse(await response.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}
