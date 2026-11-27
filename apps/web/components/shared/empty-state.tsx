import type { ComponentProps, ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  button?: ComponentProps<typeof Button>;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon = <Inbox className="size-6" />,
  button,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex min-w-0 flex-col items-center gap-4 px-4 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-contrast/6 text-muted"
        >
          {icon}
        </div>
      )}

      <div className="max-w-sm space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>

        {description && (
          <p className="text-sm text-muted">{description}</p>
        )}
      </div>

      {(button || action) && (
        <div className="flex flex-wrap justify-center gap-2">
          {button && <Button {...button} />}
          {action}
        </div>
      )}
    </div>
  );
}