"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bot, ChevronRight, Gamepad2 } from "lucide-react";
import { toast } from "sonner";
import { getGameDefinition, personalMatchesSchema, type PersonalMatches } from "@croebet/shared";
import { useSession } from "@/features/auth/session-context";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { realtimeSocket, retainRealtimeSocket } from "@/lib/realtime";
import { gameUrl } from "./game-url";
import { useLobbyExpiration } from "./lobby-expiration";
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
    const socket = realtimeSocket();
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
            toast(<Link href={destination(item)} prefetch={false} onClick={() => toast.dismiss(toastId(item.code))} className="flex w-full items-center gap-3 text-sm font-medium">
              <Gamepad2 className="size-5 shrink-0 text-brand" aria-hidden="true" />
              Sua vez em {item.gameName}
            </Link>, { id: toastId(item.code), duration: 6000, closeButton: true });
          }
          // Flip 7 announces the turn after its card animations finish.
          if (location.current !== item.code || !getGameDefinition(item.game)?.tableTurnSound) play("notification");
        }
        turns.set(item.code, key);
      }
    }
    socket.on("personal-matches", receive);
    const release = retainRealtimeSocket(userId);
    return () => {
      socket.off("personal-matches", receive);
      for (const code of turns.keys()) toast.dismiss(toastId(code));
      release();
    };
  }, [userId, play]);

  const items = confirmed?.userId === userId ? confirmed.items : [];
  useLobbyExpiration(items);
  if (!items.length) return null;
  const icon = <><Gamepad2 className="size-4" aria-hidden="true" />{items.some(item => item.yourTurn) && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand" />}</>;
  if (items.length === 1) return <Button asChild variant="secondary" size="icon" className="relative">
    <Link href={destination(items[0])} prefetch={false} aria-label={`Voltar à partida de ${items[0].gameName}`}>{icon}</Link>
  </Button>;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="secondary" size="icon" className="relative" aria-label={`Minhas partidas (${items.length})`}>{icon}</Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-80 space-y-1 p-2 max-h-[min(32rem,70dvh)] overflow-y-auto">
      <DropdownMenuLabel>Minhas partidas</DropdownMenuLabel>
      {items.map(item => <DropdownMenuItem asChild key={item.code} className="bg-contrast/4 p-3">
        <Link href={destination(item)} prefetch={false} aria-current={currentCode === item.code ? "page" : undefined} className="flex flex-col items-stretch gap-3">
          <span className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2"><span className="truncate text-sm font-medium">{item.gameName}</span>{item.development && <span className="rounded bg-contrast/6 px-1.5 py-0.5 text-[0.625rem] text-muted">Dev</span>}</span>
            <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
          </span>
          {item.participants.length > 0 && <span className="flex items-center gap-2">
            <span className="flex flex-wrap gap-1">
              {item.participants.map(person => {
                const name = person.displayName || person.username;
                return <Avatar key={person.seat} className="size-8 border-2 border-surface" title={name}>
                  <AvatarImage src={person.avatarUrl ?? undefined} alt={name} />
                  <AvatarFallback><span aria-label={name}>{person.bot ? <Bot className="size-4" aria-hidden="true" /> : name[0]?.toLocaleUpperCase("pt-BR")}</span></AvatarFallback>
                </Avatar>;
              })}
            </span>
          </span>}
          <span className="flex items-center justify-between gap-3">
            <span className={item.yourTurn ? "flex items-center gap-1.5 text-xs font-medium text-brand" : "text-xs text-muted"}>{item.yourTurn && <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />}{item.yourTurn ? "Sua vez" : item.status === "lobby" ? "No lobby" : "Em andamento"}</span>
            <span className="text-[0.625rem] text-muted">#{item.code.slice(-6)}</span>
          </span>
        </Link>
      </DropdownMenuItem>)}
    </DropdownMenuContent>
  </DropdownMenu>;
}
