export type TableMenuTarget = { kind: "deck" } | { kind: "card"; id: string };
export type TableMenuHandler = (target: TableMenuTarget, point: { x: number; y: number }) => void;
/** Presentation and game permissions never implicitly lock a player's table arrangement. */
export type PileManipulation = boolean | { deck?: boolean; discard?: boolean };
export function canManipulatePile(policy: PileManipulation | undefined, kind: "deck" | "discard") {
  return typeof policy === "boolean" ? policy : policy?.[kind] ?? true;
}
