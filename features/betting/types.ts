export type Prediction = {
  market: string;
  outcome: string;
  stake: number;
  odds?: number;
  id?: string;
  marketId?: string;
  username?: string;
  createdAt?: string;
  settlementId?: string;
  payout?: number;
  status?: "pending" | "won" | "lost" | "refunded";
};
export type Selection = Pick<Prediction, "market" | "outcome" | "marketId">;
export type IdentifiedPrediction = Prediction & {
  id: string;
  marketId: string;
  username: string;
  createdAt: string;
};
