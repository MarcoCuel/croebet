import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { resolve, join, isAbsolute } from "node:path";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { readConfig } from "../../config.ts";

export interface ImageStorage {
  put(key: string, image: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}
export const validImageKey = (key: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/.test(key);
function checkKey(key: string) { if (!validImageKey(key)) throw new Error("Chave de imagem inválida."); }

export function createImageStorage(config: ReturnType<typeof readConfig>, namespace: "avatars" | "media"): ImageStorage {
  if (config.AVATAR_STORAGE === "local") {
    if (config.APP_ENV === "production" && (!config.PRODUCTION_LOCAL_IMAGES || !isAbsolute(config.AVATAR_LOCAL_DIR))) throw new Error("Imagens locais de produção exigem diretório absoluto e autorização explícita.");
    const avatarRoot = resolve(config.AVATAR_LOCAL_DIR);
    const mediaRoot = resolve(avatarRoot, "../media");
    const root = namespace === "avatars" ? avatarRoot : mediaRoot === avatarRoot ? resolve(avatarRoot, "../admin-media") : mediaRoot;
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
  const object = (key: string) => { checkKey(key); return { Bucket: config.S3_BUCKET!, Key: `${namespace}/${key}` }; };
  return {
    async put(key, image) { await s3.send(new PutObjectCommand({ ...object(key), Body: image, ContentType: "image/webp" })); },
    async get(key) { const result = await s3.send(new GetObjectCommand(object(key))); if (!result.Body) throw new Error("Imagem indisponível."); return Buffer.from(await result.Body.transformToByteArray()); },
    async remove(key) { await s3.send(new DeleteObjectCommand(object(key))); },
  };
}
