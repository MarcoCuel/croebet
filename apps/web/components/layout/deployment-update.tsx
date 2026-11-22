"use client";

import { useEffect, useState } from "react";
import { Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { hasPendingMatchRequest } from "@/features/games/realtime";

async function release(signal = AbortSignal.timeout(5000)) {
  const response = await fetch("/api/deployment", { cache: "no-store", signal });
  if (!response.ok) throw Error("Update unavailable");
  const data: unknown = await response.json();
  return data && typeof data === "object" && "release" in data && typeof data.release === "string" ? data.release : null;
}

export function DeploymentUpdate() {
  const [available, setAvailable] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    if (refreshing) return;
    if (hasPendingMatchRequest()) {
      setMessage("Aguarde a confirmação da jogada antes de atualizar.");
      return;
    }
    setRefreshing(true);
    setMessage(null);
    try {
      if (!await release()) throw Error("Update unavailable");
      if (hasPendingMatchRequest()) {
        setMessage("Aguarde a confirmação da jogada antes de atualizar.");
      } else {
        window.location.reload();
      }
    } catch {
      setMessage("A atualização está em andamento. Tente novamente em instantes.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    const initial = process.env.NEXT_PUBLIC_RELEASE_ID ?? "development";
    let active = true, checking = false;
    const controller = new AbortController();
    async function check() {
      if (checking || document.hidden) return;
      checking = true;
      try {
        const next = await release(AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]));
        if (active && next && next !== initial) setAvailable(true);
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
    };
  }, []);
  return (
    <Dialog open={available}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={event => event.preventDefault()}
        onInteractOutside={event => event.preventDefault()}
      >
        <Dices className="mb-4 size-6 text-brand" aria-hidden="true" />
        <DialogTitle className="pr-0">Atualização disponível</DialogTitle>
        <DialogDescription>
          A dona da bet deve ter manipulado os números de novo… Atualize para continuar de onde parou.
        </DialogDescription>
        {message && <p role="status" className="mt-4 text-sm text-muted">{message}</p>}
        <Button className="mt-6 w-full" loading={refreshing} onClick={() => { void refresh(); }}>
          Atualizar e continuar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
