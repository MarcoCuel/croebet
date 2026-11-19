import { z } from "zod";

export const healthSchema = z.object({ status: z.literal("ok"), service: z.literal("croebet-api") }).strict();
export const readinessSchema = z.object({ status: z.enum(["ready", "unavailable"]) }).strict();
export const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }).strict() }).strict();
export type Health = z.infer<typeof healthSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;


export const usernameSchema = z.string().trim().min(3, "Use pelo menos 3 caracteres no usuário.").max(24).regex(/^[A-Za-z0-9._]+$/, "Use letras, números, ponto ou sublinhado.");
const passwordSchema = z.string().refine(value => Array.from(value).length >= 8 && Array.from(value).length <= 128, "Use uma senha de 8 a 128 caracteres.");
export const registerSchema = z.object({ username: usernameSchema, password: passwordSchema }).strict();
export const loginSchema = z.object({ username: usernameSchema, password: z.string().min(1).max(512) }).strict();
export const deleteAccountSchema = z.object({ password: z.string().min(1).max(512) }).strict();
export const changeUsernameSchema = z.object({ username: usernameSchema }).strict();
export const profileSchema = z.object({ displayName: z.string().trim().min(1).max(40).regex(/^[^\u0000-\u001f\u007f]+$/u) }).strict();
export const avatarUrlSchema = z.string().regex(/^\/api\/v1\/avatars\/[0-9a-f-]{36}\.webp$/).nullable().default(null);
export const publicUserSchema = z.object({ id: z.uuid(), username: usernameSchema, displayName: z.string(), avatarUrl: avatarUrlSchema, usernameChangeAvailableAt: z.iso.datetime().nullable().default(null), role: z.enum(["user", "admin"]) }).strict();
export const sessionSchema = z.object({ user: publicUserSchema.nullable() }).strict();
export type PublicUser = z.infer<typeof publicUserSchema>;
export const publicProfileSchema = z.object({ username: usernameSchema, displayName: z.string(), avatarUrl: avatarUrlSchema }).strict();
export type PublicProfile = z.infer<typeof publicProfileSchema>;
