import { z } from "zod";

/** Global presentation only: never includes seats, hands, visibility or game rules. */
export const tableVisualSettingsSchema = z.object({
  numberCardColor: z.string().regex(/^#[0-9a-f]{6}$/i).default("#ad158f"),
  localCardScale: z.number().min(0.5).max(1.5).default(1),
  opponentCardScale: z.number().min(0.5).max(1.5).default(1),
  localHandCurve: z.number().min(0).max(2).default(1),
  deckX: z.number().min(-50).max(50).default(-1.5), deckZ: z.number().min(-100).max(100).default(-0.6),
  deckRotation: z.number().min(-180).max(180).default(-18), deckScale: z.number().min(0.65).max(1.8).default(1),
  discardX: z.number().min(-50).max(50).default(0), discardZ: z.number().min(-100).max(100).default(0.15),
  discardRotation: z.number().min(-180).max(180).default(0), discardScale: z.number().min(0.65).max(1.8).default(1),
  angle: z.number().min(25).max(65).default(36), light: z.number().min(0).max(2.5).default(1.1),
  ambient: z.number().min(0).max(2).default(1.35), pointLight: z.number().min(0).max(8).default(3),
  pointHeight: z.number().min(1).max(5).default(2.5), exposure: z.number().min(0.5).max(1.2).default(1),
  shadowSoftness: z.number().min(1).max(12).default(6), shadowOpacity: z.number().min(0).max(0.8).default(0.35),
  pileHeight: z.number().min(0.004).max(0.008).default(0.004),
  duration: z.number().min(0.15).max(2).default(0.65), arc: z.number().min(0).max(2).default(0.8),
  shadows: z.boolean().default(true),
});
export const defaultTableVisualSettings = tableVisualSettingsSchema.parse({});
export const tableVisualPresetSchema = z.object({
  version: z.number().int().nonnegative(), settings: tableVisualSettingsSchema.strict(),
}).strict();
export type TableVisualPreset = z.infer<typeof tableVisualPresetSchema>;
