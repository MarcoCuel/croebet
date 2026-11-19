import { z } from "zod";
const postgresUrl = z.string().refine(value => {
  try { const url = new URL(value); return ["postgres:", "postgresql:"].includes(url.protocol) && url.pathname.length > 1 && !url.searchParams.has("options"); }
  catch { return false; }
}, "Informe uma URL PostgreSQL com banco explícito, sem options.");
const configSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: postgresUrl,
  WEB_ORIGIN: z.url().default("http://localhost:3000"),
  CSRF_SECRET: z.string().min(32),
  AVATAR_STORAGE: z.enum(["local", "s3"]).default("local"),
  AVATAR_LOCAL_DIR: z.string().min(1).default(".data/avatars"),
  S3_REGION: z.string().min(1).default("auto"),
  S3_ENDPOINT: z.url().optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false").transform(value => value === "true"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
});
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const result = configSchema.safeParse(env);
  if (!result.success) throw new Error(`Configuração inválida: ${result.error.issues.map(i => i.path.join(".")).join(", ")}`);
  const origin = new URL(result.data.WEB_ORIGIN);
  if (origin.origin !== result.data.WEB_ORIGIN || (result.data.APP_ENV === "production" && origin.protocol !== "https:")) throw new Error("WEB_ORIGIN deve ser uma origem exata; produção exige HTTPS.");
  if (result.data.APP_ENV === "production" && result.data.AVATAR_STORAGE !== "s3") throw new Error("Produção exige AVATAR_STORAGE=s3.");
  if (result.data.AVATAR_STORAGE === "s3" && (!result.data.S3_BUCKET || !result.data.S3_ACCESS_KEY_ID || !result.data.S3_SECRET_ACCESS_KEY)) throw new Error("Configure bucket e credenciais S3 na API.");
  if (result.data.APP_ENV === "production" && result.data.S3_ENDPOINT && new URL(result.data.S3_ENDPOINT).protocol !== "https:") throw new Error("S3 de produção exige HTTPS.");
  return result.data;
}

