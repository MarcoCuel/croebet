import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { chatCursorSchema, chatSendSchema, chatMuteSchema, chatPageQuerySchema, chatSyncQuerySchema } from "@croebet/shared";
import { tokenHash } from "../auth/security.ts";
import { ChatError, readChat, syncChat, sendChat, moderateChat } from "./service.ts";

type Options = { pool: Pool; sessionName: string; current: (token: string | undefined, touch?: boolean) => Promise<{id:string}|null>; limit: (key:string, maximum:number) => Promise<boolean> };
export async function chatRoutes(app: FastifyInstance, { pool, current, sessionName, limit }: Options) {
  // Inside authRoutes: shared Origin, CSRF, environment and no-store hooks apply.
  async function run(request: FastifyRequest, reply: FastifyReply, work: (id:string,hash:string)=>Promise<unknown>) {
    const token = request.cookies[sessionName];
    const user = await current(token, request.method!=="GET");
    if (!user || !token) return reply.code(401).send({error:{code:"UNAUTHENTICATED",message:"Entre novamente."}});
    if (!await limit(`chat:${request.method}:${user.id}`, request.method==="GET" ? 7200 : 600)) return reply.code(429).send({error:{code:"RATE_LIMIT",message:"Muitas solicitações. Aguarde um pouco."}});
    try { return await work(user.id, tokenHash(token)); }
    catch(error) {
      if(error instanceof ChatError) return reply.code(error.status).send({error:{code:error.code,message:error.message}});
      if(error instanceof z.ZodError) return reply.code(400).send({error:{code:"INVALID_INPUT",message:"Dados do chat inválidos."}});
      throw error;
    }
  }
  app.get("/api/v1/chat", (req,reply)=>run(req,reply,id=>readChat(pool,id,chatPageQuerySchema.parse(req.query).before)));
  app.get("/api/v1/chat/sync", (req,reply)=>run(req,reply,id=>syncChat(pool,id,chatSyncQuerySchema.parse(req.query).after)));
  app.post("/api/v1/chat", (req,reply)=>run(req,reply,(id,hash)=>sendChat(pool,id,hash,chatSendSchema.parse(req.body))));
  app.delete<{Params:{id:string}}>("/api/v1/chat/messages/:id",(req,reply)=>run(req,reply,(id,hash)=>moderateChat(pool,id,hash,{kind:"delete",id:chatCursorSchema.parse(req.params.id)})));
  app.patch<{Params:{id:string}}>("/api/v1/chat/users/:id/mute",(req,reply)=>run(req,reply,(id,hash)=>moderateChat(pool,id,hash,{kind:"mute",id:z.uuid().parse(req.params.id),minutes:chatMuteSchema.parse(req.body).minutes})));
}
