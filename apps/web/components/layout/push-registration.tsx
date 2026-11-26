"use client";

import { useEffect } from "react";
import { registerServiceWorker, syncPushSubscription } from "@/features/push/client";

/** Keeps the push service worker registered between visits. */
export function PushRegistration() {
  useEffect(() => { void (async () => { await registerServiceWorker(); await syncPushSubscription(); })(); }, []);
  return null;
}
