"use client";

import { useMemo, useSyncExternalStore } from "react";

export type Coupon = {
  id: string; code: string; amount: number; limit: number | null;
  startsAt: string; endsAt: string; paused: boolean;
  redemptions: { username: string; at: string; amount: number }[];
};
const key = "croebet:demo-admin-coupons:v1";
const event = "croebet:coupons-changed";
const examples: Coupon[] = [
  { id: "live", code: "CROELIVE", amount: 100, limit: 100, startsAt: "", endsAt: "", paused: false, redemptions: [
    { username: "atinha", at: "2026-11-18T19:30", amount: 100 },
    { username: "marco", at: "2026-11-18T19:25", amount: 100 },
    { username: "croefan", at: "2026-11-18T19:20", amount: 100 },
  ] },
  { id: "volta", code: "VOLTAAMANHA", amount: 50, limit: null, startsAt: "", endsAt: "", paused: true, redemptions: [] },
  { id: "especial", code: "CROE2027", amount: 250, limit: 50, startsAt: "2027-01-01T00:00", endsAt: "2027-01-02T23:59", paused: false, redemptions: [] },
  { id: "antigo", code: "LIVEPASSADA", amount: 75, limit: 200, startsAt: "", endsAt: "2026-11-01T23:59", paused: false, redemptions: [] },
];
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(event, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(event, callback); };
}
function snapshot() { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } }
export function useDemoCoupons() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const coupons = useMemo<Coupon[]>(() => {
    if (!raw) return examples;
    try { const value = JSON.parse(raw); if (Array.isArray(value) && value.every((c) => typeof c.id === "string" && typeof c.code === "string" && Number.isSafeInteger(c.amount) && c.amount > 0 && (c.limit === null || Number.isSafeInteger(c.limit) && c.limit > 0) && typeof c.startsAt === "string" && typeof c.endsAt === "string" && typeof c.paused === "boolean" && Array.isArray(c.redemptions) && c.redemptions.every((r: Coupon["redemptions"][number]) => typeof r.username === "string" && typeof r.at === "string" && Number.isSafeInteger(r.amount)))) return value; } catch { /* Ignore invalid demo data. */ }
    return examples;
  }, [raw]);
  function save(next: Coupon[]) {
    localStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event(event));
  }
  return { coupons, save };
}
export function couponStatus(c: Coupon) {
  if (c.endsAt && new Date(c.endsAt).getTime() <= Date.now()) return "Expirado";
  if (c.limit !== null && c.redemptions.length >= c.limit) return "Esgotado";
  if (c.paused) return "Pausado";
  if (c.startsAt && new Date(c.startsAt).getTime() > Date.now()) return "Agendado";
  return "Ativo";
}
