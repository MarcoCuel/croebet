export type Prediction = {
  market: string;
  outcome: string;
  stake: number;
  odds?: number;
};
export type Selection = Omit<Prediction, "stake">;
