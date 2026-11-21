"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Gamepad2 } from "lucide-react";
import { toast } from "sonner";
import { personalMatchesSchema, type PersonalMatches } from "@croebet/shared";
import { useSession } from "@/features/auth/session-context";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { gameSocket, retainGameSocket } from "./realtime";
import { gameUrl } from "./game-url";
import { useGameAudio } from "./use-game-audio";

type Item = PersonalMatches["items"][number];
const destination = (item: Item) => gameUrl(item.game, { code: item.code });
const toastId = (code: string) => `match-turn:${code}`;

export function ActiveMatchesMenu() {
  const { userId } = useSession();
  const { play } = useGameAudio("notifications");
  const pathname = usePathname();
  const search = useSearchParams();
  const currentCode = pathname.startsWith("/jogos/") ? search.get("partida") : null;
  const location = useRef(currentCode);
  useEffect(() => { location.current = currentCode; if (currentCode) toast.dismiss(toastId(currentCode)); }, [currentCode]);
  const [confirmed, setConfirmed] = useState<{ userId: string; items: Item[] } | null>(null);

  useEffect(() => {
    if (!userId) return;
    const socket = gameSocket();
    const turns = new Map<string, string | null>();
    function receive(value: unknown) {
      const result = personalMatchesSchema.safeParse(value);
      if (!result.success) return;
      const items = result.data.items;
      setConfirmed({ userId: userId!, items });
      for (const code of turns.keys()) if (!items.some(item => item.code === code && item.yourTurn)) {
        toast.dismiss(toastId(code)); turns.delete(code);
      }
      for (const item of items) {
        const key = item.yourTurn ? item.turnKey : null;
        if (key && turns.get(item.code) !== key) {
          if (location.current !== item.code) {
            toast.custom(() => <Link href={destination(item)} prefetch={false} onClick={() => toast.dismiss(toastId(item.code))} className="flex w-full items-center gap-3 text-sm font-medium">
              <Gamepad2 className="size-5 shrink-0 text-brand" aria-hidden="true" />
              Sua vez em {item.gameName}
            </Link>, { id: toastId(item.code), duration: Infinity });
          }
          // Flip 7 announces the turn after its card animations finish.
          if (location.current !== item.code || item.game !== "flip7") play("notification");
        }
        turns.set(item.code, key);
      }
    }
    socket.on("personal-matches", receive);
    const release = retainGameSocket(userId);
    return () => {
      socket.off("personal-matches", receive);
      for (const code of turns.keys()) toast.dismiss(toastId(code));
      release();
    };
  }, [userId, play]);

  const items = confirmed?.userId === userId ? confirmed.items : [];
  if (!items.length) return null;
  const icon = <><Gamepad2 className="size-4" aria-hidden="true" />{items.some(item => item.yourTurn) && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand" />}</>;
  if (items.length === 1) return <Button asChild variant="secondary" size="icon" className="relative">
    <Link href={destination(items[0])} prefetch={false} aria-label={`Voltar à partida de ${items[0].gameName}`}>{icon}</Link>
  </Button>;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="secondary" size="icon" className="relative" aria-label={`Minhas partidas (${items.length})`}>{icon}</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-64">
      <DropdownMenuLabel>Minhas partidas</DropdownMenuLabel>
      {items.map(item => <DropdownMenuItem asChild key={item.code}>
        <Link href={destination(item)} prefetch={false} className="flex flex-col items-start gap-1">
          <span>{item.gameName}{item.development && <span className="ml-2 text-xs text-muted">Dev</span>}</span>
          <span className={item.yourTurn ? "text-xs text-brand" : "text-xs text-muted"}>{item.yourTurn ? "Sua vez" : item.status === "lobby" ? "No lobby" : "Em andamento"}</span>
        </Link>
      </DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
