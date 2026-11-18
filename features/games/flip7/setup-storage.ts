import type { GameOptions } from "./types";
import { readMatch } from "./match-storage.ts";

export type SetupPreferences = GameOptions & { count: number };
export const setupStorageKey = "croebet:flip7:setup";
const defaults: SetupPreferences = { count: 2, mode: "classic", brutal: false };

export function readSetupPreferences(storage?: Storage): SetupPreferences {
  try {
    const source = storage ?? window.localStorage;
    const raw = source.getItem(setupStorageKey);
    if (!raw) {
      const match = readMatch(source);
      return match ? { count: match.game.players.length, mode: match.game.mode, brutal: match.game.brutal } : { ...defaults };
    }
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object" && "count" in value && "mode" in value && "brutal" in value
      && Number.isInteger(value.count) && Number(value.count) >= 2 && Number(value.count) <= 12
      && (value.mode === "classic" || value.mode === "vengeance") && typeof value.brutal === "boolean") {
      return { count: Number(value.count), mode: value.mode, brutal: value.brutal };
    }
  } catch { /* Keep the setup usable when browser storage is unavailable. */ }
  return { ...defaults };
}

export function saveSetupPreferences(preferences: SetupPreferences, storage: Storage = window.localStorage) {
  storage.setItem(setupStorageKey, JSON.stringify(preferences));
}
