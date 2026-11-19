import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { processAvatar, avatarMaxBytes } from "../dist/modules/avatars/image.js";
import { createAvatarStorage } from "../dist/modules/avatars/storage.js";
import { cleanupAvatars } from "../dist/modules/avatars/cleanup.js";
import { readConfig } from "../dist/config.js";
import { createApp } from "../dist/app.js";
import { authRoutes } from "../dist/modules/auth/routes.js";
import { csrfToken } from "../dist/modules/auth/security.js";

const config = readConfig({ APP_ENV: "test", DATABASE_URL: "postgresql://localhost/test", CSRF_SECRET: "test-secret-with-at-least-32-characters", WEB_ORIGIN: "http://localhost:3000" });
const image = () => sharp({ create: { width: 400, height: 200, channels: 3, background: "red" } }).png().withMetadata().toBuffer();

test("avatar é decodificado, recortado e regravado sem metadados; rejeita conteúdo e dimensões inválidos", async () => {
  const result = await processAvatar(await image(), "image/png");
  const metadata = await sharp(result).metadata();
  assert.equal(metadata.width, 256); assert.equal(metadata.height, 256); assert.equal(metadata.format, "webp");
  assert.equal(metadata.exif, undefined); assert.equal(metadata.icc, undefined);
  for (const [body, type] of [[Buffer.from("corrupt"), "image/png"], [await image(), "image/jpeg"], [Buffer.from('<svg/>'), "image/svg+xml"], [Buffer.alloc(avatarMaxBytes + 1), "image/png"], [Buffer.alloc(0), "image/png"]])
    await assert.rejects(processAvatar(body, type));
  const large = await sharp({ create: { width: 5001, height: 5000, channels: 3, background: "red" } }).png().toBuffer();
  await assert.rejects(processAvatar(large, "image/png"));
  const animated = await sharp({ create: { width: 2, height: 4, channels: 3, background: "red", pageHeight: 2 } })
    .composite([{ input: { create: { width: 2, height: 2, channels: 3, background: "blue" } }, top: 2, left: 0 }]).webp({ loop: 0 }).toBuffer();
  await assert.rejects(processAvatar(animated, "image/webp"));
});

test("armazenamento local persiste e remove sem aceitar caminhos; produção exige S3 configurado", async t => {
  const root = await mkdtemp(join(tmpdir(), "croebet-avatar-")); t.after(() => rm(root, { recursive: true, force: true }));
  const storage = createAvatarStorage({ ...config, AVATAR_LOCAL_DIR: root });
  const key = `${randomUUID()}.webp`, bytes = await processAvatar(await image(), "image/png");
  await storage.put(key, bytes); assert.deepEqual(await storage.get(key), bytes);
  await assert.rejects(storage.put(key, bytes));
  await assert.rejects(storage.get("../secret")); await assert.rejects(storage.remove("../secret"));
  await storage.remove(key); await storage.remove(key); await assert.rejects(storage.get(key));
  assert.throws(() => createAvatarStorage({ ...config, APP_ENV: "production" }));
  assert.throws(() => readConfig({ ...config, APP_ENV: "production", WEB_ORIGIN: "https://example.com" }));
  assert.throws(() => readConfig({ ...config, AVATAR_STORAGE: "s3" }));
});

async function fixture(t) {
  const app = createApp(async () => {}); t.after(() => app.close());
  const token = "a".repeat(43), nonce = "b".repeat(43);
  let user = { id: randomUUID(), username: "Tonho", display_name: "Tonho Público", role: "user", status: "active", username_changed_at: null, avatar_key: null };
  const files = new Map(), pending = new Set();
  let failUpload = false, active = true, failUpdate = false, attempts = 0;
  const query = async (sql, params) => {
    if (sql.includes("application_environment")) return { rows: [{ environment: "test" }] };
    if (sql.includes("auth_rate_limits")) return { rows: [{ attempts: ++attempts }] };
    if (sql.startsWith("update sessions") || sql.startsWith("select u.*")) return { rows: active ? [{ ...user }] : [] };
    if (sql.startsWith("update users set avatar_key")) {
      if (failUpdate) throw new Error("database unavailable");
      user = { ...user, avatar_key: params[0] }; return { rows: [{ ...user }] };
    }
    if (sql.startsWith("insert into avatar_cleanup")) { pending.add(params[0]); return { rows: [] }; }
    if (sql.startsWith("delete from avatar_cleanup")) { pending.delete(params[0]); return { rows: [] }; }
    if (sql.startsWith("select username")) return { rows: active ? [{ ...user }] : [] };
    if (sql.startsWith("select 1 from users")) return { rows: active && user.avatar_key === params[0] ? [{ exists: 1 }] : [] };
    if (sql.startsWith("select key from avatar_cleanup")) return { rows: [...pending].map(key => ({ key })) };
    assert.ok(["begin", "commit", "rollback"].includes(sql), sql); return { rows: [] };
  };
  const pool = { query, connect: async () => ({ query, release() {} }) };
  const storage = { put: async (key, data) => { if (failUpload) throw new Error("S3 unavailable"); files.set(key, data); }, get: async key => { if (!files.has(key)) throw new Error("missing"); return files.get(key); }, remove: async key => { files.delete(key); } };
  await app.register(authRoutes, { pool, config, avatarStorage: storage });
  const cookies = { "croebet-session": token, "croebet-csrf": nonce };
  const headers = { origin: config.WEB_ORIGIN, "x-csrf-token": csrfToken(config.CSRF_SECRET, nonce, token), "content-type": "image/png" };
  return { app, headers, cookies, pool, storage, files, pending, setActive: value => { active = value; }, failUpload: () => { failUpload = true; }, failUpdate: () => { failUpdate = true; } };
}

test("upload autorizado atualiza sessão e perfil público; troca/remoção invalidam foto antiga e limpam arquivos", async t => {
  const f = await fixture(t);
  async function put() { return f.app.inject({ method: "PUT", url: "/api/v1/me/avatar", cookies: f.cookies, headers: f.headers, payload: await image() }); }
  const first = await put(); assert.equal(first.statusCode, 200);
  const url = first.json().user.avatarUrl;
  assert.match(url, /^\/api\/v1\/avatars\//);
  assert.equal((await f.app.inject("/api/v1/profiles/Tonho")).json().avatarUrl, url);
  assert.equal((await f.app.inject({ url: "/api/v1/me", cookies: f.cookies })).json().user.avatarUrl, url);
  const photo = await f.app.inject(url); assert.equal(photo.statusCode, 200);
  assert.match(photo.headers["content-type"], /image\/webp/); assert.equal(photo.headers["x-content-type-options"], "nosniff");
  assert.equal(first.body.includes("avatar_key"), false);
  const second = await put(); assert.equal(second.statusCode, 200); assert.notEqual(second.json().user.avatarUrl, url);
  assert.equal((await f.app.inject(url)).statusCode, 404);
  await cleanupAvatars(f.pool, f.storage, "test"); assert.equal(f.files.size, 1);
  const removed = await f.app.inject({ method: "DELETE", url: "/api/v1/me/avatar", cookies: f.cookies, headers: f.headers });
  assert.equal(removed.statusCode, 200); assert.equal(removed.json().user.avatarUrl, null);
  await cleanupAvatars(f.pool, f.storage, "test"); assert.equal(f.files.size, 0);
});

test("upload recusa sessão ausente/revogada, CSRF, excesso e conteúdo falso sem substituir avatar", async t => {
  const f = await fixture(t);
  const put = (extra = {}) => f.app.inject({ method: "PUT", url: "/api/v1/me/avatar", cookies: f.cookies, headers: f.headers, payload: Buffer.from("fake"), ...extra });
  assert.equal((await put({ headers: { ...f.headers, origin: "https://evil.example" } })).statusCode, 403);
  assert.equal((await put({ cookies: {} })).statusCode, 403);
  assert.equal((await put({ payload: Buffer.alloc(avatarMaxBytes + 1) })).statusCode, 413);
  assert.equal((await put()).statusCode, 400); assert.equal(f.files.size, 0);
  f.setActive(false); assert.equal((await put()).statusCode, 401);
  assert.equal((await f.app.inject({ method: "DELETE", url: "/api/v1/me/avatar", cookies: f.cookies, headers: f.headers })).statusCode, 401);
});

for (const failure of ["failUpload", "failUpdate"]) test(`falha ${failure} não confirma foto e mantém limpeza persistida`, async t => {
  const f = await fixture(t);
  const previous = await f.app.inject({ method: "PUT", url: "/api/v1/me/avatar", cookies: f.cookies, headers: f.headers, payload: await image() });
  assert.equal(previous.statusCode, 200);
  f[failure]();
  const result = await f.app.inject({ method: "PUT", url: "/api/v1/me/avatar", cookies: f.cookies, headers: f.headers, payload: await image() });
  assert.equal(result.statusCode, 503); assert.equal(f.pending.size, 1);
  assert.equal((await f.app.inject({ url: "/api/v1/me", cookies: f.cookies })).json().user.avatarUrl, previous.json().user.avatarUrl);
  await cleanupAvatars(f.pool, f.storage, "test"); assert.equal(f.files.size, 1); assert.equal(f.pending.size, 0);
});

test("limpeza mantém fila para retry quando o armazenamento está indisponível", async t => {
  const f = await fixture(t);
  const key = `${randomUUID()}.webp`; f.pending.add(key); f.files.set(key, Buffer.from("old"));
  await assert.rejects(cleanupAvatars(f.pool, { ...f.storage, remove: async () => { throw new Error("offline"); } }, "test"));
  assert.equal(f.pending.has(key), true); assert.equal(f.files.has(key), true);
  await assert.rejects(cleanupAvatars(f.pool, f.storage, "development"));
  assert.equal(f.files.has(key), true);
  await cleanupAvatars(f.pool, f.storage, "test"); assert.equal(f.pending.size, 0); assert.equal(f.files.size, 0);
});


test("adaptador S3 usa bucket privado e prefixo fixo para enviar, ler e remover o WebP", async t => {
  const commands = [];
  const bytes = Buffer.from("processed-avatar");
  t.mock.method(S3Client.prototype, "send", async command => {
    commands.push(command);
    if (command instanceof GetObjectCommand) return { Body: { transformToByteArray: async () => bytes } };
    return {};
  });
  const storage = createAvatarStorage(readConfig({ APP_ENV: "production", DATABASE_URL: "postgresql://localhost/test", CSRF_SECRET: "test-secret-with-at-least-32-characters", WEB_ORIGIN: "https://example.com", AVATAR_STORAGE: "s3", S3_BUCKET: "test-bucket", S3_REGION: "us-east-1", S3_ACCESS_KEY_ID: "test", S3_SECRET_ACCESS_KEY: "test" }));
  const key = `${randomUUID()}.webp`;
  await storage.put(key, bytes); assert.deepEqual(await storage.get(key), bytes); await storage.remove(key);
  assert.ok(commands[0] instanceof PutObjectCommand); assert.ok(commands[2] instanceof DeleteObjectCommand);
  assert.equal(commands[0].input.ContentType, "image/webp"); assert.equal(commands[0].input.Body, bytes);
  assert.equal(commands[0].input.ACL, undefined);
  for (const command of commands) { assert.equal(command.input.Bucket, "test-bucket"); assert.equal(command.input.Key, `avatars/${key}`); }
  await assert.rejects(storage.put("../bad", bytes)); assert.equal(commands.length, 3);
});


test("limite de upload por conta impede novas decodificações após vinte tentativas", async t => {
  const f = await fixture(t);
  for (let attempt = 0; attempt < 21; attempt++) {
    const result = await f.app.inject({ method: "PUT", url: "/api/v1/me/avatar", cookies: f.cookies, headers: f.headers, payload: Buffer.from("invalid") });
    assert.equal(result.statusCode, attempt < 20 ? 400 : 429);
  }
  assert.equal(f.files.size, 0);
});
