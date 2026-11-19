import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { readConfig } from "../../config.ts";

export interface AvatarStorage {
  put(key: string, image: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
export const validAvatarKey = (key: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/.test(key);
export const avatarUrl = (key: string | null | undefined) => key ? `/api/v1/avatars/${key}` : null;
function checkKey(key: string) { if (!validAvatarKey(key)) throw new Error("Chave de avatar inválida."); }

export function createAvatarStorage(config: ReturnType<typeof readConfig>): AvatarStorage {
  if (config.AVATAR_STORAGE === "local") {
    if (config.APP_ENV === "production") throw new Error("Avatares de produção exigem S3.");
    const root = resolve(config.AVATAR_LOCAL_DIR);
    return {
      async put(key, image) { checkKey(key); await mkdir(root, { recursive: true }); await writeFile(join(root, key), image, { flag: "wx" }); },
      async get(key) { checkKey(key); return readFile(join(root, key)); },
      async remove(key) { checkKey(key); await rm(join(root, key), { force: true }); },
    };
  }
  const s3 = new S3Client({
    region: config.S3_REGION,
    endpoint: config.S3_ENDPOINT,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: config.S3_ACCESS_KEY_ID!, secretAccessKey: config.S3_SECRET_ACCESS_KEY! },
    maxAttempts: 3,
    requestHandler: { connectionTimeout: 5000, requestTimeout: 10000 },
  });
  const object = (key: string) => { checkKey(key); return { Bucket: config.S3_BUCKET!, Key: `avatars/${key}` }; };
  return {
    async put(key, image) { await s3.send(new PutObjectCommand({ ...object(key), Body: image, ContentType: "image/webp" })); },
    async get(key) { const result = await s3.send(new GetObjectCommand(object(key))); if (!result.Body) throw new Error("Avatar indisponível."); return Buffer.from(await result.Body.transformToByteArray()); },
    async remove(key) { await s3.send(new DeleteObjectCommand(object(key))); },
  };
}
