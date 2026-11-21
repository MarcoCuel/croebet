"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { PersonalMatches } from "@croebet/shared";
import { lobbyActionResultSchema } from "@croebet/shared";
import { Button } from "@/components/ui/button";
import { randomUUID } from "@/lib/uuid";
import { realtimeRequest } from "./realtime";

type Item = PersonalMatches["items"][number];
const noticeId = (code: string) => `lobby-expiration:${code}`;

export function useLobbyExpiration(items: Item[]) {
  useEffect(() => {
    const shown = new Set<string>();
    function check() {
      for (const item of items) {
        if (!item.lobbyExpiresAt) continue;
        const remaining = Date.parse(item.lobbyExpiresAt) - Date.now();
        if (remaining > 0 && remaining <= 120000) {
          shown.add(item.code);
          toast.custom(() => <LobbyExpirationNotice item={item} />, { id: noticeId(item.code), duration: Infinity });
        } else { toast.dismiss(noticeId(item.code)); }
      }
    }
    check();
    const timer = window.setInterval(check, 5000);
    return () => { window.clearInterval(timer); for (const code of shown) toast.dismiss(noticeId(code)); };
  }, [items]);
}

function LobbyExpirationNotice({ item }: { item: Item }) {
  const [busy, setBusy] = useState(false);
  async function keepOpen() {
    if (busy) return;
    setBusy(true);
    try {
      await realtimeRequest({ type: "keep-open", code: item.code, input: { commandId: randomUUID() } }, lobbyActionResultSchema);
      toast.dismiss(noticeId(item.code));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível manter o lobby aberto."); }
    finally { setBusy(false); }
  }
  return <div role="alert" className="space-y-3">
    <p className="text-sm font-medium">Ainda aguardando para jogar {item.gameName}?</p>
    <p className="text-sm text-muted">Seu lobby será encerrado às {new Date(item.lobbyExpiresAt!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} se você não confirmar.</p>
    <Button size="sm" loading={busy} disabled={busy} onClick={() => void keepOpen()}>Manter lobby aberto</Button>
  </div>;
}
