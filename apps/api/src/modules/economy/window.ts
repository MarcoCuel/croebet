import type { BonusWindowSettings } from "@croebet/shared";

export type BonusWindowState = { active: boolean; window: { start: string; end: string } | null };

// Intl resolves the product timezone, including calendar boundaries, without relying on the host TZ.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let value = formatters.get(timeZone);
  if (!value) {
    value = new Intl.DateTimeFormat("en-CA", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    formatters.set(timeZone, value);
  }
  return value;
}
function localParts(instant: Date, timeZone: string) {
  const parts: Record<string, string> = {};
  for (const part of formatter(timeZone).formatToParts(instant)) if (part.type !== "literal") parts[part.type] = part.value;
  return parts;
}
export function localMinuteOfDay(instant: Date, timeZone: string) {
  const parts = localParts(instant, timeZone);
  return Number(parts.hour) * 60 + Number(parts.minute);
}
function minutesOf(clock: string) {
  const [hour, minute] = clock.split(":").map(Number);
  return hour! * 60 + minute!;
}

export function bonusWindowState(settings: BonusWindowSettings, now: Date, timeZone: string): BonusWindowState {
  if (!settings.enabled || settings.windows.length === 0) return { active: false, window: null };
  const minute = localMinuteOfDay(now, timeZone);
  const window = settings.windows.find(item => minute >= minutesOf(item.start) && minute < minutesOf(item.end)) ?? null;
  return { active: window !== null, window };
}

// An open window raises the daily claim limit from one to two; the wallet locks serialize claims.
export function dailyClaimLimit(state: BonusWindowState) {
  return state.active ? 2 : 1;
}
