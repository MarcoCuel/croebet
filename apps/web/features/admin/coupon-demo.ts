"use client";

import { useMemo, useSyncExternalStore } from "react";

export type Coupon = {
  id: string; code: string; amount: number; limit: number | null;
  startsAt: string; endsAt: string; paused: boolean;
  redemptions: { username: string; at: string; amount: number }[];
};
const key = "croebet:demo-admin-coupons:v1";
const event = "croebet:coupons-changed";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(event, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(event, callback); };
}
function snapshot() { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } }
export function useDemoCoupons() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const coupons = useMemo<Coupon[]>(() => {
    if (!raw) return [];
    try { const value = JSON.parse(raw); if (Array.isArray(value) && value.every((c) => typeof c.id === "string" && typeof c.code === "string" && Number.isSafeInteger(c.amount) && c.amount > 0 && (c.limit === null || Number.isSafeInteger(c.limit) && c.limit > 0) && typeof c.startsAt === "string" && typeof c.endsAt === "string" && typeof c.paused === "boolean" && Array.isArray(c.redemptions) && c.redemptions.every((r: Coupon["redemptions"][number]) => typeof r.username === "string" && typeof r.at === "string" && Number.isSafeInteger(r.amount)))) return value; } catch { /* Ignore invalid demo data. */ }
    return [];
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
