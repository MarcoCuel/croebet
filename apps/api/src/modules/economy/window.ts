import type { BonusWindowSettings } from "@croebet/shared";

export type BonusWindowState = { active: boolean; nextStartAt: Date | null };

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
// Wall-clock distance from the instant read in the product timezone; applied to a UTC wall time it yields the true instant.
function offsetMs(instant: Date, timeZone: string) {
  const parts = localParts(instant, timeZone);
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)) - instant.getTime();
}
function instantOf(now: Date, minute: number, timeZone: string, dayOffset: number) {
  const parts = localParts(now, timeZone);
  const wall = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + dayOffset, Math.floor(minute / 60), minute % 60);
  // Two passes converge on the local time even across offset transitions.
  const first = wall - offsetMs(new Date(wall), timeZone);
  return new Date(wall - offsetMs(new Date(first), timeZone));
}

export function bonusWindowState(settings: BonusWindowSettings, now: Date, timeZone: string): BonusWindowState {
  if (!settings.enabled || settings.windows.length === 0) return { active: false, nextStartAt: null };
  const minute = localMinuteOfDay(now, timeZone);
  const active = settings.windows.some(window => minute >= minutesOf(window.start) && minute < minutesOf(window.end));
  let nextStartAt: Date | null = null;
  for (const dayOffset of [0, 1]) {
    for (const window of settings.windows) {
      const candidate = instantOf(now, minutesOf(window.start), timeZone, dayOffset);
      if (candidate.getTime() > now.getTime() && (!nextStartAt || candidate < nextStartAt)) nextStartAt = candidate;
    }
  }
  return { active, nextStartAt };
}

// An open window raises the daily claim limit from one to two; the wallet locks serialize claims.
export function dailyClaimLimit(state: BonusWindowState) {
  return state.active ? 2 : 1;
}
