import { matchResultSchema, type MatchCommand, type CreateMatch, type Match, type MatchResult } from "@croebet/shared";
import { managementRequest } from "@/features/admin/management-api";

// Keep only the just-confirmed creation across navigation so its initial deal
// can animate once. Reload/resume always uses the server snapshot.
let created: MatchResult | null = null;
export async function createServerMatch(input: CreateMatch) {
  const result = await managementRequest("/matches", matchResultSchema, "POST", input);
  created = result;
  return result;
}
export function createdPresentation(match: Match | null) {
  return match && created?.match.id === match.id && created.match.version === match.version ? created : null;
}
export function clearCreatedPresentation(code: string | undefined) {
  if (created?.match.code === code) created = null;
}
export const sendMatchCommand = (code: string, input: MatchCommand) => managementRequest(`/matches/${code}/commands`, matchResultSchema, "POST", input);
export const abandonServerMatch = (code: string, commandId: string, expectedVersion: number) => managementRequest(`/matches/${code}/abandon`, matchResultSchema, "POST", { commandId, expectedVersion });
