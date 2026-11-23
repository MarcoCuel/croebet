import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export type TableSeatSummary = {
  status?: string;
  score?: number;
  liveScore?: number;
  tokens?: number;
  tokenGoal?: number;
};

export function TableSeatBadge({ name, avatar, active, local, compact, onActivate, summary, label, disabled, selected }: {
  name: string; avatar?: string; active: boolean; local: boolean; compact: boolean; onActivate: () => void; summary?: TableSeatSummary; label?: string; disabled?: boolean; selected?: boolean;
}) {
  return <Button variant="ghost" onClick={onActivate} disabled={disabled} aria-pressed={selected} aria-label={label ?? `Passar vez para ${name}`} className={`h-auto w-max min-h-0 justify-start gap-4 rounded-none border-0 bg-transparent p-0 text-left font-normal text-foreground hover:bg-transparent disabled:opacity-100 ${compact ? "text-xs" : "text-sm"}`} title={`${name}${active ? local ? " · Sua vez" : " · Vez deste jogador" : ""}`}>
    <Avatar className={`${compact ? "size-10" : "size-12"} ${selected ? "shadow-[0_0_0_2px_var(--color-brand)]" : ""}`}><AvatarImage src={avatar} /><AvatarFallback>{name.slice(0, 1)}</AvatarFallback></Avatar>
    <span className="min-w-0">
      <span className="flex items-baseline gap-2 whitespace-nowrap"><span className={`max-w-32 truncate font-medium ${active && !summary?.status ? "text-brand" : ""}`}>{name}</span>{summary?.status && <span className={active ? "text-brand" : "text-muted"}>{summary.status}</span>}</span>
      {summary?.score !== undefined && <span className="mt-0.5 flex gap-2 whitespace-nowrap tabular-nums"><span>{summary.score}<span className="sr-only"> pontos</span></span>{summary.liveScore !== undefined && <span className="text-muted">{summary.liveScore} ao vivo</span>}</span>}
      {summary?.tokens !== undefined && <span className="mt-1 flex w-max flex-nowrap items-center gap-1 whitespace-nowrap" aria-label={summary.tokenGoal !== undefined ? `${summary.tokens} de ${summary.tokenGoal} fichas para vencer` : `${summary.tokens} ${summary.tokens === 1 ? "ficha" : "fichas"}`}>
        {Array.from({ length: summary.tokenGoal ?? summary.tokens }, (_, index) => <span key={index} className={`size-3 shrink-0 rounded-full ${index < (summary.tokens ?? 0) ? "bg-brand" : "bg-contrast/10"}`} aria-hidden="true" />)}
        {summary.tokenGoal !== undefined && <span className="ml-1 shrink-0 text-muted tabular-nums" aria-hidden="true">{summary.tokens}/{summary.tokenGoal}</span>}
      </span>}
      {active && <span className="sr-only">{local ? "Sua vez" : "Vez deste jogador"}</span>}
    </span>
  </Button>;
}
