import { z } from "zod";
export const socialIds = ["coup", "dixit", "secret-hitler", "spyfall"] as const;
export const socialIdSchema = z.enum(socialIds);
export type SocialId = z.infer<typeof socialIdSchema>;
export const socialSettings = {
  coup: {
    min: 2,
    max: 6,
    title: "Coup",
    purpose:
      "Seja a última família com influência. Você pode reivindicar uma função mesmo sem ter a carta.",
  },
  dixit: {
    min: 3,
    max: 6,
    title: "Dixit",
    purpose:
      "Dê uma pista que só parte da mesa consiga decifrar. Vote na imagem de quem contou a história.",
  },
  "secret-hitler": {
    min: 5,
    max: 10,
    title: "Secret Hitler",
    purpose:
      "Discuta as candidaturas, vote no governo e acompanhe as políticas. Sua condição de vitória depende do seu papel.",
  },
  spyfall: {
    min: 3,
    max: 8,
    title: "Spyfall",
    purpose:
      "Faça perguntas sobre o local sem entregá-lo. O espião tenta descobri-lo antes de ser identificado.",
  },
} as const;
export const socialOptionsSchema = z
  .object({
    mode: z.literal("social"),
    brutal: z.literal(false).default(false),
  })
  .strict();
const seat = z.number().int().min(0).max(9);
export const socialActionSchema = z
  .object({
    type: z.literal("social-choice"),
    game: socialIdSchema,
    seat,
    key: z.string().min(1).max(100),
    text: z.string().trim().min(1).max(180).optional(),
  })
  .strict();
export const choiceSchema = z
  .object({
    key: z.string(),
    label: z.string(),
    art: z.number().int().min(0).max(83).optional(),
    input: z.string().optional(),
  })
  .strict();
export type Choice = z.infer<typeof choiceSchema>;
export type SocialAction = z.infer<typeof socialActionSchema>;
export const socialViewSchema = z
  .object({
    game: socialIdSchema,
    phase: z.string(),
    round: z.number().int().positive(),
    turn: seat,
    winners: z.array(seat),
    log: z.array(z.string()),
    heading: z.string(),
    board: z.array(z.string()),
    images: z.array(z.number().int().min(0).max(83)),
    notes: z.array(z.string()),
    hand: z.array(z.number().int()),
    choices: z.array(choiceSchema),
    deadline: z.number().nullable(),
    players: z.array(
      z.object({
        name: z.string(),
        kind: z.enum(["normal", "human"]),
        score: z.number().int(),
        active: z.boolean(),
        detail: z.string(),
      }),
    ),
  })
  .strict();
export type SocialView = z.infer<typeof socialViewSchema>;
