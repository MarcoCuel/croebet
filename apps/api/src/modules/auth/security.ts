import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export const newToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export function csrfToken(secret: string, nonce: string, session: string) {
  return createHmac("sha256", secret).update(JSON.stringify([nonce, tokenHash(session)])).digest("hex");
}
export function validCsrf(secret: string, nonce: string | undefined, session: string, value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value) && typeof nonce === "string" && /^[A-Za-z0-9_-]{43}$/.test(nonce)
    && timingSafeEqual(Buffer.from(csrfToken(secret, nonce, session)), Buffer.from(value));
}
