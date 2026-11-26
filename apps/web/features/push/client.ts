"use client";

import { pushStatusSchema, pushSubscriptionsResultSchema, pushTestResultSchema, type PushStatus } from "@croebet/shared";

export type PushState = "unsupported" | "blocked" | "off" | "on";

export function pushSupported() {
  return typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("/sw.js", { scope: "/" }); }
  catch { return null; }
}

function decodeKey(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const raw = atob(normalized);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function request<T>(path: string, method: "GET" | "POST" | "DELETE", body: unknown, parse: (value: unknown) => T): Promise<T> {
  const headers: Record<string, string> = {};
  if (method !== "GET") {
    const csrf = await fetch("/api/v1/auth/csrf", { credentials: "same-origin", cache: "no-store" });
    if (!csrf.ok) throw new Error("Não foi possível validar a sessão.");
    headers["x-csrf-token"] = (await csrf.json()).token;
    headers["content-type"] = "application/json";
  }
  const response = await fetch(`/api/v1${path}`, { method, headers, credentials: "same-origin", cache: "no-store", body: method === "GET" ? undefined : JSON.stringify(body ?? {}) });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error?.message ?? "Não foi possível concluir a operação.");
  }
  return parse(await response.json());
}

export const readPushStatus = (): Promise<PushStatus> => request("/me/push", "GET", undefined, pushStatusSchema.parse);
export const sendPushTest = () => request("/me/push/test", "POST", {}, pushTestResultSchema.parse);

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  if (Notification.permission !== "granted") return "off";
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    return await registration?.pushManager.getSubscription() ? "on" : "off";
  } catch { return "off"; }
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("Este navegador não oferece notificações push.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("A permissão de notificações não foi concedida.");
  const registration = await registerServiceWorker();
  if (!registration) throw new Error("Não foi possível registrar o service worker.");
  const status = await readPushStatus();
  if (!status.enabled || !status.publicKey) return { subscriptions: 0, pushEnabled: false };
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(status.publicKey) as BufferSource });
  const result = await save(subscription);
  return { ...result, pushEnabled: true };
}

function subscriptionInput(subscription: PushSubscription) {
  const json = subscription.toJSON();
  // Browsers also expose expirationTime; the API stores only what it needs.
  return { endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } };
}

function save(subscription: PushSubscription) {
  return request("/me/push/subscriptions", "POST", subscriptionInput(subscription), pushSubscriptionsResultSchema.parse);
}

/** Re-registers an existing browser subscription after login or a server restore. */
export async function syncPushSubscription() {
  if (!pushSupported() || Notification.permission !== "granted") return;
  const registration = await registerServiceWorker();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const status = await readPushStatus().catch(() => null);
  if (!status?.enabled) return;
  await save(subscription).catch(() => {});
}

export async function disablePush() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  try { await request("/me/push/subscriptions", "DELETE", { endpoint: subscription.endpoint }, pushSubscriptionsResultSchema.parse); }
  finally { await subscription.unsubscribe().catch(() => {}); }
}
