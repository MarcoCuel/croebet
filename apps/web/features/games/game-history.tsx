import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type GameHistoryEntry = {
  message: string;
  player?: { name: string; avatarUrl?: string | null };
  card?: ReactNode;
};

/** Entries arrive newest first; game adapters supply only public event data. */
export function GameHistory({ entries }: { entries: GameHistoryEntry[] }) {
  return <ol className="space-y-3">{entries.length ? entries.map((entry, index) => (
    <li key={index} className="flex items-center gap-2 border-b border-contrast/6 pb-3 last:border-0">
      {entry.player && <Avatar className="size-7" aria-hidden="true">
        <AvatarImage src={entry.player.avatarUrl ?? undefined} />
        <AvatarFallback>{Array.from(entry.player.name)[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback>
      </Avatar>}
      <span className="min-w-0 flex-1 break-words">{entry.message}</span>
      {entry.card && <div className="h-14 w-9 shrink-0 [&>*]:h-full [&>*]:w-full [&>*]:rounded-md">{entry.card}</div>}
    </li>
  )) : <li>Aguardando a primeira jogada.</li>}</ol>;
}
