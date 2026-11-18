import { createApp } from "./app.ts";
import { readConfig } from "./config.ts";
import { createDatabase } from "./db/client.ts";
const config = readConfig();
const { pool } = createDatabase(config.DATABASE_URL);
pool.on("error", () => console.error("Falha na conexão ociosa com PostgreSQL."));
const app = createApp(async () => {
  const result = await pool.query("select environment from application_environment where id = 1");
  if (result.rows[0]?.environment !== config.APP_ENV) throw new Error("Ambiente do banco incompatível.");
}, true);
app.addHook("onClose", async () => { await pool.end(); });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => {
  void app.close().catch(() => { process.exitCode = 1; });
});
try { await app.listen({ host: config.API_HOST, port: config.API_PORT }); }
catch { console.error("Não foi possível iniciar a API."); await app.close(); process.exitCode = 1; }

