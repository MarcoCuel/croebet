import { economySchema } from "@croebet/shared";

// Single source of approved economic values. The browser receives this via HTTP.
export const economy = Object.freeze(economySchema.parse({
  initialBalance: 30,
  dailyReward: 10,
  dailyCooldownHours: 24,
  suggestedBets: [1, 5, 10, 50],
  defaultBet: 5,
}));
export const issuanceAccountId = "00000000-0000-4000-8000-000000000001";
