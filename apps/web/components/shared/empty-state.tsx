import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon = <Inbox className="size-6" />, action, className }: EmptyStateProps) {
  return (
    <div data-slot="empty-state" className={cn("flex min-w-0 flex-col items-center gap-3 px-5 py-12 text-center", className)}>
      {icon && <div aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-full bg-contrast/6 text-muted">{icon}</div>}
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
