import { z } from "zod";
import { iconNameSchema, iconNodeSchema } from "./icons.js";

export const achievementMetrics = {
  games: { label: "Partidas concluídas", unit: "partidas" },
  wins: { label: "Vitórias", unit: "vitórias" },
  dailyDays: { label: "Dias com bônus resgatado", unit: "dias" },
  dailyStreak: { label: "Maior sequência de bônus diário", unit: "dias seguidos" },
  coupons: { label: "Cupons resgatados", unit: "cupons" },
  losingGames: { label: "Partidas com prejuízo em Croins", unit: "partidas" },
} as const;
export const achievementMetricSchema = z.enum(["games", "wins", "dailyDays", "dailyStreak", "coupons", "losingGames"]);
const emblemImageSchema = z.string().regex(/^$|^\/api\/v1\/media\/[0-9a-f-]{36}\.webp$/, "Selecione uma imagem da biblioteca.").default("");
const achievementColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor hexadecimal com seis dígitos.").nullable().default(null);
const positive = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const achievementLevelWriteSchema = z.object({ id: z.uuid(), color: achievementColorSchema, imageUrl: emblemImageSchema, target: positive, description: z.string().trim().min(1).max(240) }).strict();
export const achievementWriteSchema = z.object({
  name: z.string().trim().min(1).max(80), color: achievementColorSchema, icon: iconNameSchema, imageUrl: emblemImageSchema,
  metric: achievementMetricSchema, active: z.boolean(), order: z.number().int().min(0).max(2147483647),
  version: z.number().int().nonnegative(), levels: z.array(achievementLevelWriteSchema).min(1, "Adicione pelo menos um nível."),
}).strict().superRefine((input, ctx) => {
  const ids = new Set<string>();
  input.levels.forEach((level, index) => {
    if (ids.has(level.id)) ctx.addIssue({ code: "custom", path: ["levels", index, "id"], message: "Há níveis duplicados." });
    ids.add(level.id);
    if (index && level.target <= input.levels[index - 1].target) ctx.addIssue({ code: "custom", path: ["levels", index, "target"], message: "As metas devem crescer a cada nível." });
  });
});
export const achievementDefinitionSchema = z.object({
  id: z.uuid(), name: z.string(), color: achievementColorSchema, icon: iconNameSchema, imageUrl: emblemImageSchema, metric: achievementMetricSchema, active: z.boolean(),
  order: z.number().int().nonnegative(), version: z.number().int().positive(),
  levels: z.array(achievementLevelWriteSchema.extend({ locked: z.boolean() })),
});
export const achievementDefinitionsSchema = z.object({ items: z.array(achievementDefinitionSchema) });
export const achievementProgressSchema = z.object({
  id: z.uuid(), name: z.string(), color: achievementColorSchema, icon: iconNameSchema, imageUrl: emblemImageSchema, iconNode: iconNodeSchema, metric: achievementMetricSchema,
  current: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  levels: z.array(achievementLevelWriteSchema.extend({ unlockedAt: z.iso.datetime().nullable() })),
});
export const achievementsSchema = z.object({
  items: z.array(achievementProgressSchema),
  stats: z.object({ currentStreak: z.number().int().nonnegative(), games: z.number().int().nonnegative(), lostCroins: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) }),
});
export type AchievementMetric = z.infer<typeof achievementMetricSchema>;
export type AchievementWrite = z.infer<typeof achievementWriteSchema>;
export type AchievementDefinition = z.infer<typeof achievementDefinitionSchema>;
export type Achievements = z.infer<typeof achievementsSchema>;
