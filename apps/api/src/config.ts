import { z } from "zod";
const postgresUrl = z.string().refine(value => {
  try { const url = new URL(value); return ["postgres:", "postgresql:"].includes(url.protocol) && url.pathname.length > 1 && !url.searchParams.has("options"); }
  catch { return false; }
}, "Informe uma URL PostgreSQL com banco explícito, sem options.");
const configSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: postgresUrl,
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = configSchema.safeParse(env);
  if (!result.success) throw new Error(`Configuração inválida: ${result.error.issues.map(i => i.path.join(".")).join(", ")}`);
  return result.data;
}

