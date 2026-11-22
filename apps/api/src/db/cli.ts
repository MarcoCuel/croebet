import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readConfig } from "../config.ts";
import { assertResetAllowed } from "./reset-guard.ts";
const config = readConfig();
const command = process.argv[2];
if (!["migrate", "seed", "reset"].includes(command)) throw new Error("Comando de banco inválido.");
if (config.APP_ENV === "production" && !process.env.DATABASE_MIGRATION_URL) throw new Error("Produção exige credencial de migration separada.");
// Reset nunca usa uma credencial de produção ou eleva para a credencial de migrations.
const connectionString = command === "reset" ? config.DATABASE_URL : process.env.DATABASE_MIGRATION_URL ?? config.DATABASE_URL;
if (command === "reset" && (config.APP_ENV === "production" || process.env.NODE_ENV === "production")) throw new Error("Reset proibido em produção.");
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 3000, statement_timeout: 15000 });
try {
  await client.connect();
  await client.query("select pg_advisory_lock(47851233)");
  const exists = await client.query("select to_regclass('public.application_environment') as name");
  if (exists.rows[0]?.name) {
    const identity = await client.query("select environment from public.application_environment where id = 1");
    if (identity.rows[0]?.environment && identity.rows[0].environment !== config.APP_ENV) throw new Error("Ambiente incompatível.");
  }
  if (command === "reset") {
    const marker = await client.query("select environment, current_database() as name from application_environment where id = 1");
    assertResetAllowed(process.env, marker.rows[0]?.environment, marker.rows[0]?.name, connectionString);
    await client.query("begin");
    try { await client.query("drop schema public cascade; drop schema if exists drizzle cascade; create schema public"); await client.query("commit"); }
    catch (error) { await client.query("rollback"); throw error; }
  }
  if (command === "migrate" || command === "reset") await migrate(drizzle(client), { migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)) });
  if (command === "seed" || command === "reset") {
    const result = await client.query("insert into application_environment (id, environment) values (1, $1) on conflict (id) do update set environment = application_environment.environment returning environment", [config.APP_ENV]);
    if (result.rows[0]?.environment !== config.APP_ENV) throw new Error("O banco já pertence a outro ambiente.");
    await client.query("insert into games (slug,name,module_id) values ('flip7','Flip 7','flip7') on conflict do nothing");
  }
  console.log(`Banco: ${command} concluído.`);
} catch { console.error("Operação de banco recusada ou indisponível. Confira ambiente, permissões e configuração."); process.exitCode = 1; }
finally { await client.end(); }

