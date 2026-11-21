export type TableMenuTarget = { kind: "deck" } | { kind: "card"; id: string };
export type TableMenuHandler = (target: TableMenuTarget, point: { x: number; y: number }) => void;
