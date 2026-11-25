import { advanceDeferredMatches } from "./modules/matches/service.ts";
import { createImageStorage } from "./modules/storage/images.ts";
import { cleanupMedia } from "./modules/media/service.ts";
import { cleanupDeletedAccounts } from "./modules/auth/account-cleanup.ts";
import { cleanupAuthState } from "./modules/auth/cleanup.ts";
import { createApp } from "./app.ts";
import { readConfig } from "./config.ts";
import { createDatabase } from "./db/client.ts";
import { authRoutes } from "./modules/auth/routes.ts";
import { createAvatarStorage } from "./modules/avatars/storage.ts";
import { cleanupAvatars } from "./modules/avatars/cleanup.ts";
const config = readConfig();
const { pool } = createDatabase(config.DATABASE_URL);
pool.on("error", () => console.error("Falha na conexão ociosa com PostgreSQL."));
const app = createApp(async () => {
  const result = await pool.query("select environment from application_environment where id = 1");
  if (result.rows[0]?.environment !== config.APP_ENV) throw new Error("Ambiente do banco incompatível.");
}, true);
const avatarStorage = createAvatarStorage(config);
const mediaStorage = createImageStorage(config, "media");
await app.register(authRoutes, { pool, config, avatarStorage, mediaStorage });
let cleanupTask: Promise<void> | undefined;
function cleanup() {
  cleanupTask ??= cleanupDeletedAccounts(pool, config.APP_ENV)
    .then(() => cleanupAvatars(pool, avatarStorage, config.APP_ENV))
    .then(() => cleanupMedia(pool, mediaStorage, config.APP_ENV))
    .then(async () => { await cleanupAuthState(pool, config.APP_ENV); })
    .catch(() => { app.log.warn("Não foi possível concluir as exclusões pendentes; nova tentativa em um minuto."); })
    .finally(() => { cleanupTask = undefined; });
  return cleanupTask;
}
let automationTask:Promise<void>|undefined;
const automationTimer=setInterval(()=>{
 automationTask ??= advanceDeferredMatches(pool).catch(()=>{app.log.warn("Não foi possível avançar as automações de partidas; uma nova tentativa será feita.");}).finally(()=>{automationTask=undefined;});
},250);
automationTimer.unref();
const cleanupTimer = setInterval(() => { void cleanup(); }, 60000);
cleanupTimer.unref();
void cleanup();
app.addHook("onClose", async () => { clearInterval(cleanupTimer); clearInterval(automationTimer); await automationTask; await cleanupTask; await pool.end(); });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => {
  void app.close().catch(() => { process.exitCode = 1; });
});
try { await app.listen({ host: config.API_HOST, port: config.API_PORT }); }
catch { console.error("Não foi possível iniciar a API."); await app.close(); process.exitCode = 1; }

