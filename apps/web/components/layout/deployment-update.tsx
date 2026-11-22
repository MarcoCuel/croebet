"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { hasPendingMatchRequest } from "@/features/games/realtime";

const notification = "deployment-update";

export function DeploymentUpdate() {
  useEffect(() => {
    const initial = process.env.NEXT_PUBLIC_RELEASE_ID ?? "development";
    let active = true, checking = false;
    const controller = new AbortController();
    async function release() {
      const response = await fetch("/api/deployment", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]) });
      if (!response.ok) throw Error("Update unavailable");
      const data: unknown = await response.json();
      return data && typeof data === "object" && "release" in data && typeof data.release === "string" ? data.release : null;
    }
    async function refresh() {
      if (hasPendingMatchRequest()) {
        toast.info("Aguarde a confirmação da jogada antes de atualizar.");
        return;
      }
      try {
        if (await release() && active && !hasPendingMatchRequest()) window.location.reload();
      } catch {
        if (active) toast.info("A atualização está em andamento. Tente novamente em instantes.");
      }
    }
    async function check() {
      if (checking || document.hidden) return;
      checking = true;
      try {
        const next = await release();
        if (active && next && next !== initial) toast.info("Atualização disponível", {
          id: notification, duration: Infinity, description: "Atualize para continuar de onde parou.",
          action: { label: "Atualizar e continuar", onClick: event => { event.preventDefault(); void refresh(); } },
        });
      } catch { /* Keep the confirmed page during an outage; the next check retries. */ }
      finally { checking = false; }
    }
    const timer = setInterval(() => { void check(); }, 15000);
    const visible = () => { if (!document.hidden) void check(); };
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    void check();
    return () => {
      active = false; controller.abort(); clearInterval(timer);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
      toast.dismiss(notification);
    };
  }, []);
  return null;
}
