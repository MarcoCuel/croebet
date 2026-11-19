import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { adminQuerySchema, userChangeSchema, balanceAdjustmentSchema, couponWriteSchema, couponsQuerySchema,
  redeemCouponSchema, adminUserDetailSchema, couponDetailSchema } from "@croebet/shared";
import { tokenHash } from "../auth/security.ts";
import { readTransactions, WalletError } from "../wallet/service.ts";
import { ManagementError, readAdminUser, readAdminUsers, readAudit, changeUser, adjustBalance, readCoupon, readCoupons, readRedemptions, saveCoupon } from "./service.ts";
import { redeemCoupon } from "./redeem.ts";
import { pageSlugSchema, pageWriteSchema } from "@croebet/shared";
import { readPageLinks, readPage, readPages, savePage } from "../pages/service.ts";

type Options = { pool: Pool; sessionName: string; current: (token: string | undefined) => Promise<{ id: string; role: string } | null>; limit: (key: string, maximum: number) => Promise<boolean> };
export async function managementRoutes(app: FastifyInstance, options: Options) {
  const { pool, current, sessionName, limit } = options;
  async function run(request: FastifyRequest, reply: FastifyReply, admin: boolean, action: (actor: { id: string; role: string }, hash: string) => Promise<unknown>) {
    const actor = await current(request.cookies[sessionName]);
    if (!actor || (admin && actor.role !== "admin")) return reply.code(admin ? 404 : 401).send({ error: { code: admin ? "NOT_FOUND" : "UNAUTHENTICATED", message: admin ? "Recurso não encontrado." : "Entre novamente." } });
    if (request.method !== "GET" && !await limit(`management:${actor.id}`, 120)) return reply.code(429).send({ error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente novamente mais tarde." } });
    try { return await action(actor, tokenHash(request.cookies[sessionName]!)); }
    catch (error) {
      if (error instanceof ManagementError) return reply.code(error.status).send({ error: { code: error.code, message: error.message } });
      if (error instanceof z.ZodError) return reply.code(400).send({ error: { code: "INVALID_INPUT", message: error.issues[0].message } });
      if (error instanceof WalletError) return reply.code(409).send({ error: { code: error.code, message: error.code === "INSUFFICIENT_FUNDS" ? "Saldo insuficiente para a retirada." : "Não foi possível movimentar a carteira. Confira os valores." } });
      if (error && typeof error === "object" && "code" in error && error.code === "23505") return reply.code(409).send({ error: { code: "CONFLICT", message: "Este código ou endereço já existe, ou este pedido já foi processado." } });
      throw error;
    }
  }
  const id = (request: FastifyRequest) => z.uuid().parse((request.params as { id: string }).id);
  const slug = (request: FastifyRequest) => pageSlugSchema.parse((request.params as { slug: string }).slug);
  app.get("/api/v1/pages", async () => readPageLinks(pool));
  app.get("/api/v1/pages/:slug", async (request, reply) => {
    const parsed = pageSlugSchema.safeParse((request.params as { slug: string }).slug);
    if (!parsed.success) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Página não encontrada." } });
    try { return await readPage(pool, parsed.data); }
    catch (error) { if (error instanceof ManagementError) return reply.code(error.status).send({ error: { code: error.code, message: error.message } }); throw error; }
  });
  app.get("/api/v1/admin/pages", (request, reply) => run(request, reply, true, async () => readPages(pool)));
  app.get("/api/v1/admin/pages/:slug", (request, reply) => run(request, reply, true, async () => readPage(pool, slug(request), true)));
  app.post("/api/v1/admin/pages", (request, reply) => run(request, reply, true, async (actor, hash) => savePage(pool, actor.id, hash, null, pageWriteSchema.parse(request.body))));
  app.patch("/api/v1/admin/pages/:slug", (request, reply) => run(request, reply, true, async (actor, hash) => savePage(pool, actor.id, hash, slug(request), pageWriteSchema.parse(request.body))));
  app.get("/api/v1/admin/users", (request, reply) => run(request, reply, true, async () => readAdminUsers(pool, adminQuerySchema.parse(request.query))));
  app.get("/api/v1/admin/users/:id", (request, reply) => run(request, reply, true, async () => {
    const userId = id(request);
    const [user, transactions, audit] = await Promise.all([readAdminUser(pool, userId), readTransactions(pool, userId, 20, 0), readAudit(pool, userId)]);
    return adminUserDetailSchema.parse({ user, transactions, audit });
  }));
  app.get("/api/v1/admin/users/:id/transactions", (request, reply) => run(request, reply, true, async () => {
    const query = adminQuerySchema.parse(request.query); return readTransactions(pool, id(request), query.limit, query.offset);
  }));
  app.get("/api/v1/admin/audit/:id", (request, reply) => run(request, reply, true, async () => {
    const query = adminQuerySchema.parse(request.query); return readAudit(pool, id(request), query.offset, query.limit);
  }));
  app.patch("/api/v1/admin/users/:id", (request, reply) => run(request, reply, true, async (actor, hash) => {
    await changeUser(pool, actor.id, hash, id(request), userChangeSchema.parse(request.body)); return { ok: true };
  }));
  app.post("/api/v1/admin/users/:id/adjustments", (request, reply) => run(request, reply, true, async (actor, hash) => {
    await adjustBalance(pool, actor.id, hash, id(request), balanceAdjustmentSchema.parse(request.body)); return { ok: true };
  }));
  app.get("/api/v1/admin/coupons", (request, reply) => run(request, reply, true, async () => readCoupons(pool, couponsQuerySchema.parse(request.query))));
  app.get("/api/v1/admin/coupons/:id", (request, reply) => run(request, reply, true, async () => {
    const couponId = id(request);
    const [coupon, redemptions, audit] = await Promise.all([readCoupon(pool, couponId), readRedemptions(pool, couponId), readAudit(pool, couponId)]);
    return couponDetailSchema.parse({ coupon, redemptions, audit });
  }));
  app.get("/api/v1/admin/coupons/:id/redemptions", (request, reply) => run(request, reply, true, async () => {
    const query = adminQuerySchema.parse(request.query); return readRedemptions(pool, id(request), query.q, query.offset, query.limit);
  }));
  app.post("/api/v1/admin/coupons", (request, reply) => run(request, reply, true, async (actor, hash) => {
    const couponId = await saveCoupon(pool, actor.id, hash, null, couponWriteSchema.parse(request.body)); return { id: couponId };
  }));
  app.patch("/api/v1/admin/coupons/:id", (request, reply) => run(request, reply, true, async (actor, hash) => {
    const couponId = await saveCoupon(pool, actor.id, hash, id(request), couponWriteSchema.parse(request.body)); return { id: couponId };
  }));
  app.post("/api/v1/coupons/redeem", (request, reply) => run(request, reply, false, async (actor, hash) => redeemCoupon(pool, actor.id, hash, redeemCouponSchema.parse(request.body))));
}
