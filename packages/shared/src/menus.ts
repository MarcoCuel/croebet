import { z } from "zod";
import { iconNameSchema, iconNodeSchema } from "./icons.js";

export const fixedMenuPages = {
  home: { label: "Início", href: "/", disabled: false },
  games: { label: "Jogos", href: "/jogos", disabled: false },
  betting: { label: "Apostas", href: "/apostas", disabled: true },
  rankings: { label: "Rankings", href: "/rankings", disabled: false },
  achievements: { label: "Conquistas", href: "/conquistas", disabled: false },
  history: { label: "Carteira", href: "/carteira", disabled: false },
  profile: { label: "Perfil", href: "/perfil", disabled: false },
} as const;
export const fixedMenuPageSchema = z.enum(["home", "games", "betting", "rankings", "achievements", "history", "profile"]);
export const menuLocationSchema = z.enum(["main", "footer"]);
export function validMenuUrl(value: string): boolean {
  if (!value || value.length > 2000 || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false;
  if (value.startsWith("#")) return value.length > 1;
  try {
    const url = new URL(value, "https://croebet.invalid");
    if (value.startsWith("/")) return !value.startsWith("//") && url.origin === "https://croebet.invalid";
    return /^[a-z][a-z0-9+.-]*:/i.test(value) && ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
      && !url.username && !url.password && Boolean(url.pathname || url.hostname);
  } catch { return false; }
}
const common = { id: z.uuid(), label: z.string().trim().min(1, "Informe o rótulo.").max(80), newTab: z.boolean(), icon: iconNameSchema.nullable().optional() };
export const menuItemSchema = z.discriminatedUnion("type", [
  z.object({ ...common, type: z.literal("fixed"), target: fixedMenuPageSchema }).strict(),
  z.object({ ...common, type: z.literal("page"), pageId: z.uuid() }).strict(),
  z.object({ ...common, type: z.literal("custom"), url: z.string().trim().refine(validMenuUrl, "Informe um link interno, http, https, mailto ou tel válido.") }).strict(),
]);
const menuItemsSchema = z.array(menuItemSchema).max(50, "Cada menu pode ter até 50 itens.").refine(items => new Set(items.map(item => item.id)).size === items.length, "Há itens duplicados.");
export const menuWriteSchema = z.object({ version: z.number().int().positive(), items: menuItemsSchema }).strict();
export const menuSchema = menuWriteSchema.extend({ location: menuLocationSchema });
export const menuPageOptionSchema = z.object({ id: z.uuid(), slug: z.string(), title: z.string(), published: z.boolean() }).strict();
export const menuAdminSchema = z.object({ menus: z.array(menuSchema).length(2).refine(menus => new Set(menus.map(menu => menu.location)).size === 2), pages: z.array(menuPageOptionSchema) }).strict();
export const resolvedMenuItemSchema = z.object({ id: z.uuid(), label: z.string(), href: z.string().refine(validMenuUrl), newTab: z.boolean(), fixed: fixedMenuPageSchema.nullable(), disabled: z.boolean(), icon: iconNameSchema.nullable().optional(), iconNode: iconNodeSchema.optional() }).strict();
export const navigationSchema = z.object({ main: z.array(resolvedMenuItemSchema), footer: z.array(resolvedMenuItemSchema) }).strict();
export type MenuItem = z.infer<typeof menuItemSchema>;
export type MenuRecord = z.infer<typeof menuSchema>;
export type MenuAdmin = z.infer<typeof menuAdminSchema>;
export type NavigationData = z.infer<typeof navigationSchema>;
export type MenuLocation = z.infer<typeof menuLocationSchema>;
