import { z } from "zod";

// Local clock times in the product timezone. Windows never cross midnight.
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u, "Informe um horário entre 00:00 e 23:59.");

export const bonusWindowSchema = z.object({ start: time, end: time }).strict()
  .refine(value => value.start < value.end, { path: ["end"], message: "O término deve ser depois do início." });
export type BonusWindow = z.infer<typeof bonusWindowSchema>;

export const bonusWindowSettingsSchema = z.object({
  enabled: z.boolean(),
  windows: z.array(bonusWindowSchema).max(8),
  version: z.number().int().nonnegative(),
}).strict().superRefine((value, context) => {
  // Overlapping windows are rejected so the admin sees exactly the configured periods.
  const windows = [...value.windows].sort((left, right) => left.start.localeCompare(right.start));
  for (let index = 1; index < windows.length; index += 1) {
    if (windows[index]!.start < windows[index - 1]!.end) {
      context.addIssue({ code: "custom", path: ["windows"], message: "As janelas não podem se sobrepor." });
      return;
    }
  }
});
export type BonusWindowSettings = z.infer<typeof bonusWindowSettingsSchema>;

// Editing starts from one suggested period; the second daily claim only happens while enabled.
export const defaultBonusWindowSettings: BonusWindowSettings = { enabled: false, windows: [{ start: "18:00", end: "19:00" }], version: 0 };
