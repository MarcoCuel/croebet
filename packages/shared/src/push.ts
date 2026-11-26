import { z } from "zod";

export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(2048).refine(value => value.startsWith("https://"), "Push exige HTTPS."),
  keys: z.object({ p256dh: z.string().min(1).max(255), auth: z.string().min(1).max(255) }).strict(),
}).strict();
export const pushUnsubscribeSchema = z.object({ endpoint: z.url().max(2048).refine(value => value.startsWith("https://"), "Push exige HTTPS.") }).strict();
export const pushStatusSchema = z.object({ enabled: z.boolean(), publicKey: z.string().nullable() }).strict();
export const pushSubscriptionsResultSchema = z.object({ subscriptions: z.number().int().min(0) }).strict();
export const pushTestResultSchema = z.object({ sent: z.number().int().min(0) }).strict();

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
export type PushStatus = z.infer<typeof pushStatusSchema>;
