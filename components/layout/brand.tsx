import { cn } from "@/lib/utils";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span aria-hidden="true">
      C
      <span className={cn(compact && "@max-[8rem]/sidebar:hidden")}>
        roe
        <span className="inline-block bg-brand bg-wordmark bg-clip-text text-transparent forced-colors:text-[LinkText]">
          bet
        </span>
      </span>
    </span>
  );
}

export const brandLinkClass =
  "text-wordmark leading-none font-medium tracking-wordmark text-foreground";
