import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { createMatchSchema, matchCommandSchema, matchAbandonSchema, matchCodeSchema } from "@croebet/shared";
import { tokenHash } from "../auth/security.ts";
import { MatchError, listMatches, getMatch, createMatch, commandMatch } from "./service.ts";

type Options = { pool: Pool; sessionName: string; current: (token: string | undefined) => Promise<{ id: string } | null>; limit: (key: string, maximum: number) => Promise<boolean> };
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
  app.get("/api/v1/matches", (req, reply) => run(req,reply,id => listMatches(pool,id)));
  app.get<{ Params: { code: string } }>("/api/v1/matches/:code", (req, reply) => run(req,reply,id => getMatch(pool,id,matchCodeSchema.parse(req.params.code))));
  app.post("/api/v1/matches", (req, reply) => run(req,reply,(id,hash) => createMatch(pool,id,hash,createMatchSchema.parse(req.body))));
  app.post<{ Params: { code: string } }>("/api/v1/matches/:code/commands", (req, reply) => run(req,reply,(id,hash) => commandMatch(pool,id,hash,matchCodeSchema.parse(req.params.code),matchCommandSchema.parse(req.body))));
  app.post<{ Params: { code: string } }>("/api/v1/matches/:code/abandon", (req, reply) => run(req,reply,(id,hash) => commandMatch(pool,id,hash,matchCodeSchema.parse(req.params.code),matchAbandonSchema.parse(req.body),true)));
}
