import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export function AdminListHeader({ filters, filterLabel, search }: {
  filters: ReactNode;
  filterLabel: string;
  search: ReactNode;
}) {
  return <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
    <nav aria-label={filterLabel} className="flex flex-wrap gap-1">{filters}</nav>
    <div className="w-full sm:w-72">{search}</div>
  </div>;
}

export function AdminFilterCount({ count }: { count: number }) {
  return <Badge variant="secondary" className="min-w-5 justify-center px-1.5 py-0 text-[0.625rem] leading-5 tabular-nums">{count}</Badge>;
}
