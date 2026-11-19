import { z } from "zod";
import { lucideIconNames } from "./lucide-icon-names.js";

export { lucideIconNames };
export const iconNameSchema = z.enum(lucideIconNames, { error: "Selecione um ícone Lucide válido." });
const coordinate = z.union([z.string().max(4000), z.number()]);
export const iconNodeSchema = z.array(z.tuple([
  z.enum(["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"]),
  z.object({
    d: z.string().max(4000), points: z.string().max(4000), key: z.string(),
    cx: coordinate, cy: coordinate, r: coordinate, rx: coordinate, ry: coordinate,
    x: coordinate, y: coordinate, x1: coordinate, x2: coordinate, y1: coordinate, y2: coordinate,
    width: coordinate, height: coordinate, opacity: coordinate, strokeWidth: coordinate,
    fill: z.string(), stroke: z.string(), transform: z.string(),
    strokeLinecap: z.enum(["butt", "round", "square", "inherit"]),
    strokeLinejoin: z.enum(["miter", "round", "bevel", "inherit"]),
  }).partial().strict(),
])).max(40);
export type IconName = z.infer<typeof iconNameSchema>;
export type IconNode = z.infer<typeof iconNodeSchema>;
