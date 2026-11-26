"use client";

export type NotificationState = NotificationPermission | "unsupported";

export function notificationState(): NotificationState {
  if (typeof window === "undefined" || !("Notification" in window) || !window.isSecureContext) return "unsupported";
  return Notification.permission;
}

export async function requestNotifications(): Promise<NotificationState> {
  if (notificationState() === "unsupported") return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return notificationState(); }
}

/** In-page alert for a hidden tab. Push (closed page) is a later phase. */
export function notifyTurn(gameName: string, code: string, url: string) {
  if (typeof window === "undefined" || !document.hidden || notificationState() !== "granted") return;
  try {
    const target = new URL(url, window.location.href);
    const notification = new Notification("Sua vez", {
      body: `Sua vez em ${gameName}.`,
      icon: "/app-icon-192.png",
      tag: `turn:${code}`,
    });
    notification.onclick = () => {
      notification.close();
      window.focus();
      if (window.location.href !== target.href) window.location.assign(target.href);
    };
  } catch { /* Platforms that require a service worker fall back to the sound. */ }
}

export function notifyTest() {
  if (notificationState() !== "granted") return false;
  try {
    new Notification("Croebet", { body: "As notificações estão ativas neste dispositivo.", icon: "/app-icon-192.png", tag: "croebet:test" });
    return true;
  } catch { return false; }
}
