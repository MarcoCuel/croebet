import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { matchCodeSchema, roomSchema, matchListSchema, lobbyListSchema, type Match, type Lobby } from "@croebet/shared";

export type InitialMatches = { revision: string; match: Match | null; lobby: Lobby | null; currentLobby: Lobby | null; lobbies: Lobby[]; items: Match[]; error: string; unavailable: boolean };
export async function getInitialMatches(code: string | undefined): Promise<InitialMatches> {
  const empty: InitialMatches = { revision: randomUUID(), match: null, lobby:null,currentLobby:null,lobbies:[],items: [], error: "", unavailable: false };
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
    const [data,lobbies]=await Promise.all([request(code?`/${code}`:""),request("/lobbies")]);
    const directory=lobbyListSchema.parse(lobbies);
    const base={...empty,lobbies:directory.items,currentLobby:directory.current};
    if(code){const room=roomSchema.parse(data);return room.status==="lobby"?{...base,lobby:directory.current ?? room}:{...base,match:room};}
    return {...base,lobby:directory.current,items:matchListSchema.parse(data).items};
  }catch(error){const message=error instanceof Error?error.message:"unavailable";return {...empty,unavailable:message==="unavailable" || !["Entre novamente para acessar as salas.","Sala não encontrada."].includes(message),error:message==="unavailable"?"Não foi possível carregar as salas.":message};}
}
