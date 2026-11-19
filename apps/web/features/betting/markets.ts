export const marketStatuses = {
  draft: "Rascunho",
  open: "Aberta",
  paused: "Pausada",
  closed: "Encerrada",
  resolved: "Apurada",
  paid: "Paga",
  cancelled: "Cancelada",
} as const;
export type MarketStatus = keyof typeof marketStatuses;
export type Settlement = {
  id: string;
  marketId: string;
  kind: "payout" | "refund";
  result: string | null;
  createdAt: string;
  total: number;
  allocations: { predictionId: string; username: string; amount: number }[];
};
export type Market = {
  id: string;
  question: string;
  status: MarketStatus;
  endsAt: string | null;
  settlement?: Settlement;
  criterion: string;
} & (
  | { type: "number"; unit: string }
  | { type: "choice" | "binary"; options: string[] }
);
