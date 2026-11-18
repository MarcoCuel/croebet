import { cn } from "@/lib/utils";

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span aria-hidden="true">
      C
      <span className={cn(compact && "@max-[8rem]/sidebar:hidden")}>
        roebet
      </span>
    </span>
  );
}

export const brandLinkClass =
  "text-wordmark leading-none font-bold tracking-wordmark text-foreground";
