import { z } from "zod";

export const catalogMarketStatuses = { draft: "Rascunho", open: "Aberta", paused: "Pausada", closed: "Encerrada" } as const;
const text = z.string().trim().min(1, "Preencha este campo.");
export const catalogMarketWriteSchema = z.object({
  question: text.max(200), criterion: text.max(4000),
  type: z.enum(["binary", "choice", "number"]),
  options: z.array(text.max(200)).max(20), unit: z.string().trim().max(80),
  status: z.enum(["draft", "open", "paused", "closed"]),
  endsAt: z.iso.datetime().nullable(), version: z.number().int().nonnegative(),
}).strict().superRefine((market, context) => {
  if (market.type === "number") {
    if (!market.unit || market.options.length) context.addIssue({ code: "custom", path: ["unit"], message: "Informe a unidade e deixe as opções vazias." });
  } else {
    if (market.unit || market.options.length < 2 || new Set(market.options.map(value => value.toLocaleLowerCase("pt-BR"))).size !== market.options.length)
      context.addIssue({ code: "custom", path: ["options"], message: "Informe de 2 a 20 opções diferentes." });
    if (market.type === "binary" && (market.options.length !== 2 || market.options[0] !== "Sim" || market.options[1] !== "Não"))
      context.addIssue({ code: "custom", path: ["options"], message: "As opções devem ser Sim e Não." });
  }
});
export const catalogMarketSchema = catalogMarketWriteSchema.safeExtend({ id: z.uuid(), version: z.number().int().positive() });
export const catalogMarketsSchema = z.object({ items: z.array(catalogMarketSchema) }).strict();
export const catalogMarketDeleteSchema = z.object({ version: z.number().int().positive() }).strict();
export type CatalogMarket = z.infer<typeof catalogMarketSchema>;
