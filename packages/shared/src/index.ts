import { z } from "zod";

export const healthSchema = z.object({ status: z.literal("ok"), service: z.literal("croebet-api") }).strict();
export const readinessSchema = z.object({ status: z.enum(["ready", "unavailable"]) }).strict();
export const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }).strict() }).strict();
export type Health = z.infer<typeof healthSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;

