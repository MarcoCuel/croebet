import { tableVisualPresetSchema } from "@croebet/shared";
import { readTableVisualSettings, saveTableVisualSettings } from "./table-visual-settings.ts";
import { achievementWriteSchema } from "@croebet/shared";
import { readAchievementDefinitions, readAchievementDefinition, saveAchievement, readOwnAchievements } from "../achievements/service.ts";
import { mediaQuerySchema, mediaMaxBytes, mediaContentTypes } from "@croebet/shared";
import type { ImageStorage } from "../storage/images.ts";
import { validImageKey } from "../storage/images.ts";
import { readMedia, uploadMedia, deleteMedia } from "../media/service.ts";
import { adminUserPasswordSchema, adminUserIdentitySchema } from "@croebet/shared";
import { scheduleUserDeletion, changeUserPassword, changeUserIdentity } from "./service.ts";
import { matchHistoryQuerySchema } from "@croebet/shared";
import { readGameHistory, readMatchReplay } from "./match-history.ts";
import { catalogMarketWriteSchema, catalogMarketDeleteSchema } from "@croebet/shared";
import { readMarkets, readMarket, saveMarket, deleteMarket } from "../markets/service.ts";
import { gameCreateSchema, gameSlugSchema, gameWriteSchema } from "@croebet/shared";
import { createGame, readGame, readGames, saveGame } from "../games/service.ts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";
import { adminQuerySchema, userChangeSchema, balanceAdjustmentSchema, couponWriteSchema, couponsQuerySchema,
  redeemCouponSchema, adminUserDetailSchema, couponDetailSchema } from "@croebet/shared";
import { tokenHash } from "../auth/security.ts";
import { readTransactions, WalletError } from "../wallet/service.ts";
import { ManagementError, readAdminUser, readAdminUsers, readAudit, changeUser, adjustBalance, readCoupon, readCoupons, readRedemptions, saveCoupon } from "./service.ts";
import { redeemCoupon } from "./redeem.ts";
import { pageSlugSchema, pageWriteSchema, pageDeleteSchema } from "@croebet/shared";
import { readPageLinks, readPage, readPages, savePage, deletePage, readPageAuthors } from "../pages/service.ts";
import { menuLocationSchema, menuWriteSchema } from "@croebet/shared";
import { readNavigation, readMenus, saveMenu } from "../menus/service.ts";
import { overviewQuerySchema } from "@croebet/shared";
import { readSeo, saveSeo } from "./seo.ts";
import { seoSettingsSchema } from "@croebet/shared";
import { readOverview } from "./overview.ts";

type Options = { mediaStorage?: ImageStorage; pool: Pool; sessionName: string; current: (token: string | undefined) => Promise<{ id: string; role: string } | null>; limit: (key: string, maximum: number) => Promise<boolean> };
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
  if (options.mediaStorage) {
    const storage = options.mediaStorage;
    app.get("/api/v1/admin/media", (request, reply) => run(request, reply, true, async () => {
      const query = mediaQuerySchema.parse(request.query);
      return readMedia(pool, query.q, query.offset);
    }));
    app.post("/api/v1/admin/media", {
      bodyLimit: mediaMaxBytes,
      onRequest: async (request, reply) => {
        const actor = await current(request.cookies[sessionName]);
        if (!actor || actor.role !== "admin") return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Recurso não encontrado." } });
        if (!await limit(`media-upload:${actor.id}`, 30)) return reply.code(429).send({ error: { code: "RATE_LIMIT", message: "Muitos envios. Tente novamente mais tarde." } });
      },
    }, (request, reply) => run(request, reply, true, async (actor, hash) => {
      const type = request.headers["content-type"]?.split(";")[0] ?? "";
      if (!(mediaContentTypes as readonly string[]).includes(type) || !Buffer.isBuffer(request.body)) throw new ManagementError(400, "INVALID_IMAGE", "Escolha um JPG, PNG ou WebP.");
      const name = z.string().max(1000).parse((request.query as {name?: string}).name ?? "Imagem");
      return uploadMedia(pool, storage, actor.id, hash, request.body, type, name);
    }));
    app.delete("/api/v1/admin/media/:id", (request, reply) => run(request, reply, true, async (actor, hash) => deleteMedia(pool, actor.id, hash, id(request))));
    app.get<{Params: {key: string}}>("/api/v1/media/:key", async (request, reply) => {
      const { key } = request.params;
      if (!validImageKey(key) || !(await pool.query("select 1 from media_assets where id::text=$1 and state='ready'", [key.slice(0,-5)])).rows.length) return reply.code(404).send();
      // Recheck the live metadata even for conditional requests; deleted files must return 404.
      const etag = `"${key}"`;
      reply.header("Cache-Control", "public, no-cache").header("ETag", etag).header("X-Content-Type-Options", "nosniff");
      if (request.headers["if-none-match"] === etag) return reply.code(304).send();
      try { return reply.type("image/webp").send(await storage.get(key)); }
      catch { return reply.code(503).header("Cache-Control", "no-store").send(); }
    });
  }
  app.get("/api/v1/table-visual-settings", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    return readTableVisualSettings(pool);
  });
  app.patch("/api/v1/admin/table-visual-settings", (request, reply) => run(request, reply, true, async (actor, hash) =>
    saveTableVisualSettings(pool, actor.id, hash, tableVisualPresetSchema.parse(request.body))));
  app.get("/api/v1/seo", async () => { const settings = await readSeo(pool); return { ...settings, index: process.env.APP_ENV === "production" && settings.index }; });
  app.get("/api/v1/seo/paths", async () => {
    const settings = await readSeo(pool);
    if (process.env.APP_ENV !== "production" || !settings.index) return { paths: [] };
    const [pages, games] = await Promise.all([readPages(pool), readGames(pool)]);
    return { paths: [...(settings.home.index ? ["/"] : []), ...(settings.games.index ? ["/jogos"] : []), ...pages.items.filter(p => p.published && p.seo.index).map(p => `/${p.slug}`), ...games.items.filter(g => g.seo.index).map(g => `/jogos/${g.slug}`)] };
  });
  app.get("/api/v1/admin/seo", (request, reply) => run(request, reply, true, async () => readSeo(pool)));
  app.patch("/api/v1/admin/seo", (request, reply) => run(request, reply, true, async (actor, hash) => saveSeo(pool, actor.id, hash, seoSettingsSchema.parse(request.body))));
  app.get("/api/v1/admin/overview", (request, reply) => run(request, reply, true, async () => readOverview(pool, overviewQuerySchema.parse(request.query).days)));
  app.get("/api/v1/games", async () => readGames(pool));
  app.get("/api/v1/games/:slug", async (request, reply) => {
    const parsed = gameSlugSchema.safeParse((request.params as { slug: string }).slug);
    if (!parsed.success) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Jogo não encontrado." } });
    try { return await readGame(pool, parsed.data); }
    catch (error) { if (error instanceof ManagementError) return reply.code(error.status).send({ error: { code: error.code, message: error.message } }); throw error; }
  });
  const id = (request: FastifyRequest) => z.uuid().parse((request.params as { id: string }).id);
  app.get("/api/v1/me/achievements", (request, reply) => run(request, reply, false, async (actor, hash) => readOwnAchievements(pool, actor.id, hash)));
  app.get("/api/v1/admin/achievements", (request, reply) => run(request, reply, true, async () => readAchievementDefinitions(pool)));
  app.get("/api/v1/admin/achievements/:id", (request, reply) => run(request, reply, true, async () => readAchievementDefinition(pool, id(request))));
  app.post("/api/v1/admin/achievements", { bodyLimit: 1048576 }, (request, reply) => run(request, reply, true, async (actor, hash) => saveAchievement(pool, actor.id, hash, null, achievementWriteSchema.parse(request.body))));
  app.patch("/api/v1/admin/achievements/:id", { bodyLimit: 1048576 }, (request, reply) => run(request, reply, true, async (actor, hash) => saveAchievement(pool, actor.id, hash, id(request), achievementWriteSchema.parse(request.body))));
  app.get("/api/v1/admin/games", (request, reply) => run(request, reply, true, async () => readGames(pool, true)));
  app.get("/api/v1/admin/games/:id", (request, reply) => run(request, reply, true, async () => readGame(pool, id(request), true)));
  app.get("/api/v1/admin/games/:id/matches", (request, reply) => run(request, reply, true, async () => readGameHistory(pool, id(request), matchHistoryQuerySchema.parse(request.query))));
  app.get("/api/v1/admin/games/:id/matches/:matchId", (request, reply) => run(request, reply, true, async () => {
    const query = matchHistoryQuerySchema.parse(request.query);
    return readMatchReplay(pool, id(request), z.uuid().parse((request.params as {matchId:string}).matchId), query.offset, query.limit);
  }));
  app.post("/api/v1/admin/games", (request, reply) => run(request, reply, true, async (actor, hash) => createGame(pool, actor.id, hash, gameCreateSchema.parse(request.body))));
  app.patch("/api/v1/admin/games/:id", (request, reply) => run(request, reply, true, async (actor, hash) => saveGame(pool, actor.id, hash, id(request), gameWriteSchema.parse(request.body))));
  app.get("/api/v1/admin/markets", (request, reply) => run(request, reply, true, async () => readMarkets(pool)));
  app.get("/api/v1/admin/markets/:id", (request, reply) => run(request, reply, true, async () => readMarket(pool, id(request))));
  app.post("/api/v1/admin/markets", (request, reply) => run(request, reply, true, async (actor, hash) => saveMarket(pool, actor.id, hash, null, catalogMarketWriteSchema.parse(request.body))));
  app.patch("/api/v1/admin/markets/:id", (request, reply) => run(request, reply, true, async (actor, hash) => saveMarket(pool, actor.id, hash, id(request), catalogMarketWriteSchema.parse(request.body))));
  app.delete("/api/v1/admin/markets/:id", (request, reply) => run(request, reply, true, async (actor, hash) => deleteMarket(pool, actor.id, hash, id(request), catalogMarketDeleteSchema.parse(request.body).version)));
  app.get("/api/v1/navigation", async () => readNavigation(pool));
  app.get("/api/v1/admin/menus", (request, reply) => run(request, reply, true, async () => readMenus(pool)));
  app.patch("/api/v1/admin/menus/:location", (request, reply) => run(request, reply, true, async (actor, hash) => saveMenu(pool, actor.id, hash,
    menuLocationSchema.parse((request.params as { location: string }).location), menuWriteSchema.parse(request.body))));
  app.get("/api/v1/pages", async () => readPageLinks(pool));
  app.get("/api/v1/pages/:slug", async (request, reply) => {
    const parsed = pageSlugSchema.safeParse((request.params as { slug: string }).slug);
    if (!parsed.success) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Página não encontrada." } });
    try { return await readPage(pool, parsed.data); }
    catch (error) { if (error instanceof ManagementError) return reply.code(error.status).send({ error: { code: error.code, message: error.message } }); throw error; }
  });
  app.get("/api/v1/admin/page-authors", (request, reply) => run(request, reply, true, async () => readPageAuthors(pool)));
  app.delete("/api/v1/admin/pages/:id", (request, reply) => run(request, reply, true, async (actor, hash) => deletePage(pool, actor.id, hash, id(request), pageDeleteSchema.parse(request.body).version)));
  app.get("/api/v1/admin/pages", (request, reply) => run(request, reply, true, async () => readPages(pool)));
  app.get("/api/v1/admin/pages/:id", (request, reply) => run(request, reply, true, async () => readPage(pool, id(request), true)));
  app.post("/api/v1/admin/pages", (request, reply) => run(request, reply, true, async (actor, hash) => savePage(pool, actor.id, hash, null, pageWriteSchema.parse(request.body))));
  app.patch("/api/v1/admin/pages/:id", (request, reply) => run(request, reply, true, async (actor, hash) => savePage(pool, actor.id, hash, id(request), pageWriteSchema.parse(request.body))));
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
  app.delete("/api/v1/admin/users/:id", (request, reply) => run(request, reply, true, async (actor, hash) => {
    await scheduleUserDeletion(pool, actor.id, hash, id(request)); return { ok: true };
  }));
  app.patch("/api/v1/admin/users/:id/password", (request, reply) => run(request, reply, true, async (actor, hash) => {
    if (!await limit(`admin-password:${actor.id}`, 10)) throw new ManagementError(429, "RATE_LIMIT", "Muitas tentativas. Tente novamente mais tarde.");
    await changeUserPassword(pool, actor.id, hash, id(request), adminUserPasswordSchema.parse(request.body));
    return { ok: true };
  }));
  app.patch("/api/v1/admin/users/:id/identity", (request, reply) => run(request, reply, true, async (actor, hash) => {
    await changeUserIdentity(pool, actor.id, hash, id(request), adminUserIdentitySchema.parse(request.body)); return { ok: true };
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
