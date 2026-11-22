import { z } from "zod";
export const loveOptionsSchema = z.object({ mode:z.enum(["classic","modern"]), brutal:z.literal(false).default(false) }).strict();
export const loveActionSchema = z.discriminatedUnion("type",[
 z.object({type:z.literal("play"),card:z.number().int().min(0).max(9),target:z.number().int().min(0).max(5).optional(),guess:z.number().int().min(0).max(9).optional()}).strict(),
 z.object({type:z.literal("keep"),cards:z.array(z.number().int().min(0).max(9)).min(1).max(3)}).strict(),
 z.object({type:z.literal("continue")}).strict(),
 z.object({type:z.literal("next")}).strict()
]);
export const loveInspectionSchema=z.object({kind:z.enum(["priest","baron"]),actor:z.number().int().min(0).max(5),target:z.number().int().min(0).max(5),controller:z.number().int().min(0).max(5),cards:z.array(z.object({seat:z.number().int().min(0).max(5),value:z.number().int().min(0).max(9).nullable()})).min(1).max(2)}).strict();
export const loveViewSchema=z.object({mode:z.enum(["classic","modern"]),round:z.number().int(),turn:z.number().int(),phase:z.enum(["playing","summary","over"]),deckCount:z.number().int(),removed:z.array(z.number().int()),winners:z.array(z.number().int()),log:z.array(z.string()),pending:z.boolean(),
 players:z.array(z.object({name:z.string(),kind:z.enum(["human","normal"]),hand:z.array(z.number().int()).nullable(),handCount:z.number().int(),discard:z.array(z.number().int()),protected:z.boolean(),out:z.boolean(),tokens:z.number().int()})),
 inspection:loveInspectionSchema.nullable().default(null),privateInfo:z.array(z.string()),legalActions:z.array(loveActionSchema)
});
export type LoveView=z.infer<typeof loveViewSchema>;
export type LoveAction=z.infer<typeof loveActionSchema>;

/** Fichas para vencer conforme a edição e o número de participantes da partida. */
export function loveTokenGoal(mode: LoveView["mode"], players: number): number {
 return players === 2 ? (mode === "classic" ? 7 : 6) : players === 3 ? 5 : players === 4 ? 4 : 3;
}
