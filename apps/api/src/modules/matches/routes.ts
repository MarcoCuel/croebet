import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { cancellationVoteSchema, gameCommandSchema, confirmEntrySchema, invitePlayerSchema, lobbyPlayersQuerySchema, createMatchSchema, matchAbandonSchema, matchCodeSchema, lobbyCommandSchema, updateLobbySchema, kickMatchSchema } from "@croebet/shared";
import { matchLive } from "./live.ts";
import { tokenHash } from "../auth/security.ts";
import { abandonLove, collectiveCancellation, endTest, stepTest, commandLove, declineInvitation, refreshPresence, listLobbyPlayers, inviteLobbyPlayer, MatchError, listMatches, getMatch, createMatch, commandMatch, listLobbies, lobbyAction, kickMatch } from "./service.ts";

type Options = { pool: Pool; sessionName: string; maxConnections?: number; trustCloudflareProxy?: boolean; origins?: readonly string[]; current: (token: string | undefined) => Promise<{ id: string } | null>; csrfName: string; csrfSecret: string; environment: string; limit: (key: string, maximum: number) => Promise<boolean> };
export async function matchRoutes(app: FastifyInstance, options: Options) {
  const { pool, current, sessionName, limit } = options;
  // Registered inside authRoutes: the same Origin/CSRF/environment hooks apply.
  async function run<T>(request: FastifyRequest, reply: FastifyReply, action: (id: string, hash: string) => Promise<T>) {
    const token = request.cookies[sessionName];
    const actor = await current(token);
    if (!actor || !token) return reply.code(401).send({ error: { code: "UNAUTHENTICATED", message: "Entre novamente." } });
    if (request.method !== "GET" && !await limit(`matches:${actor.id}`, 1200)) return reply.code(429).send({ error: { code: "RATE_LIMIT", message: "Muitas ações. Aguarde e tente novamente." } });
    try { return await action(actor.id, tokenHash(token)); }
    catch (error) {
      if (error instanceof MatchError) return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "INVALID_INPUT", message: error.issues[0].message } });
      throw error;
    }
  }
  async function view<T>(request: FastifyRequest, reply: FastifyReply, action: (id: string | null) => Promise<T>) {
    try { return await action((await current(request.cookies[sessionName]))?.id ?? null); }
    catch (error) {
      if (error instanceof MatchError) return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "INVALID_INPUT", message: error.issues[0].message } });
      throw error;
    }
  }
  matchLive(app,pool,options);
  app.post<{Params:{code:string}}>("/api/v1/matches/:code/cancel-proposal",(req,reply)=>run(req,reply,(id,hash)=>collectiveCancellation(pool,id,hash,matchCodeSchema.parse(req.params.code),matchAbandonSchema.parse(req.body))));
  app.post<{Params:{code:string}}>("/api/v1/matches/:code/cancel-vote",(req,reply)=>run(req,reply,(id,hash)=>collectiveCancellation(pool,id,hash,matchCodeSchema.parse(req.params.code),cancellationVoteSchema.parse(req.body))));
  app.post<{Params:{code:string}}>("/api/v1/matches/:code/love-abandon",(req,reply)=>run(req,reply,(id,hash)=>abandonLove(pool,id,hash,matchCodeSchema.parse(req.params.code),matchAbandonSchema.parse(req.body))));
  app.post<{Params:{code:string}}>("/api/v1/matches/:code/end-test",(req,reply)=>run(req,reply,(id,hash)=>endTest(pool,id,hash,matchCodeSchema.parse(req.params.code),matchAbandonSchema.parse(req.body))));
  app.post<{Params:{code:string}}>("/api/v1/matches/:code/test-step",(req,reply)=>run(req,reply,(id,hash)=>stepTest(pool,id,hash,matchCodeSchema.parse(req.params.code),matchAbandonSchema.parse(req.body))));
  app.post<{Params:{code:string}}>("/api/v1/matches/:code/love-command",(req,reply)=>run(req,reply,(id,hash)=>commandLove(pool,id,hash,matchCodeSchema.parse(req.params.code),gameCommandSchema.parse(req.body))));
  app.post("/api/v1/matches/presence",(req,reply)=>run(req,reply,(id,hash)=>refreshPresence(pool,id,hash)));
  app.get<{Params:{code:string}}>("/api/v1/matches/:code/players",(req,reply)=>run(req,reply,id=>listLobbyPlayers(pool,id,matchCodeSchema.parse(req.params.code),lobbyPlayersQuerySchema.parse(req.query).q)));
  app.post<{Params:{code:string}}>("/api/v1/matches/:code/invite",(req,reply)=>run(req,reply,async(id,hash)=>{
    if(!await limit(`invitations:${id}`,30))return reply.code(429).send({error:{code:"RATE_LIMIT",message:"Muitos convites. Aguarde antes de enviar outros."}});
    return inviteLobbyPlayer(pool,id,hash,matchCodeSchema.parse(req.params.code),invitePlayerSchema.parse(req.body).targetUserId);
  }));
  app.post<{Params:{code:string}}>("/api/v1/matches/:code/decline",(req,reply)=>run(req,reply,(id,hash)=>declineInvitation(pool,id,hash,matchCodeSchema.parse(req.params.code))));
  app.get("/api/v1/matches/lobbies",(req,reply)=>view(req,reply,id=>listLobbies(pool,id)));
  app.post<{Params:{code:string}}>("/api/v1/matches/:code/update",(req,reply)=>run(req,reply,(id,hash)=>lobbyAction(pool,id,hash,matchCodeSchema.parse(req.params.code),"update",updateLobbySchema.parse(req.body))));
  app.post<{Params:{code:string}}>("/api/v1/matches/:code/kick",(req,reply)=>run(req,reply,(id,hash)=>kickMatch(pool,id,hash,matchCodeSchema.parse(req.params.code),kickMatchSchema.parse(req.body))));
  app.post<{Params:{code:string}}>("/api/v1/matches/:code/confirm-entry",(req,reply)=>run(req,reply,(id,hash)=>lobbyAction(pool,id,hash,matchCodeSchema.parse(req.params.code),"confirm-entry",confirmEntrySchema.parse(req.body))));
  for (const kind of ["join","leave","start"] as const) app.post<{Params:{code:string}}>(`/api/v1/matches/:code/${kind}`,(req,reply)=>run(req,reply,(id,hash)=>lobbyAction(pool,id,hash,matchCodeSchema.parse(req.params.code),kind,kind==="start"?matchAbandonSchema.parse(req.body):lobbyCommandSchema.parse(req.body))));
  app.get("/api/v1/matches", (req, reply) => view(req,reply,id => listMatches(pool,id)));
  app.get<{ Params: { code: string } }>("/api/v1/matches/:code", (req, reply) => view(req,reply,id => getMatch(pool,id,matchCodeSchema.parse(req.params.code))));
  app.post("/api/v1/matches", (req, reply) => run(req,reply,(id,hash) => createMatch(pool,id,hash,createMatchSchema.parse(req.body))));
  app.post<{ Params: { code: string } }>("/api/v1/matches/:code/commands", (req, reply) => run(req,reply,(id,hash) => commandMatch(pool,id,hash,matchCodeSchema.parse(req.params.code),gameCommandSchema.parse(req.body))));
  app.post<{ Params: { code: string } }>("/api/v1/matches/:code/abandon", (req, reply) => run(req,reply,(id,hash) => commandMatch(pool,id,hash,matchCodeSchema.parse(req.params.code),matchAbandonSchema.parse(req.body),true)));
}
