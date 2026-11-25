import Fastify from "fastify";
import { healthSchema, readinessSchema } from "@croebet/shared";
export function createApp(checkDatabase: () => Promise<void>, logger = false) {
  const app = Fastify({ logger: logger ? { redact: ["req.headers.cookie", "req.headers.authorization", "req.headers.x-csrf-token"] } : false, bodyLimit: 65536, requestTimeout: 10000 });
  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    return payload;
  });
  app.get("/api/v1/health", async () => healthSchema.parse({ status: "ok", service: "croebet-api" }));
  app.get("/api/v1/health/ready", async (_request, reply) => {
    try { await checkDatabase(); return readinessSchema.parse({ status: "ready" }); }
    catch { return reply.code(503).send(readinessSchema.parse({ status: "unavailable" })); }
  });
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: { code: "NOT_FOUND", message: "Rota não encontrada." } }));
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const candidate = error instanceof Error && "statusCode" in error ? error.statusCode : undefined;
    const status = typeof candidate === "number" && candidate >= 400 && candidate < 500 ? candidate : 500;
    return reply.code(status).send({ error: { code: status === 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST", message: status === 500 ? "Não foi possível concluir a operação." : "Requisição inválida." } });
  });
  return app;
}

