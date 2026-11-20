import type { ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AdminListHeader({ filters, filterLabel, search, create }: {
  filters: ReactNode;
  filterLabel: string;
  search: ReactNode;
  create?: { href: string; label: string };
}) {
  return <div data-slot="admin-list-header" className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
    <nav aria-label={filterLabel} className="flex flex-wrap gap-1">{filters}</nav>
    <div className="ml-auto flex w-full max-w-full min-w-0 items-center gap-3 sm:w-auto">
      <div className="min-w-0 flex-1 sm:w-72">{search}</div>
      {create && <Button asChild className="bg-none px-3 inset-shadow-none sm:px-4">
        <Link href={create.href} aria-label={create.label}>
          <Plus className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{create.label}</span>
        </Link>
      </Button>}
    </div>
  </div>;
}

export function AdminFilterCount({ count }: { count: number }) {
  return <Badge variant="secondary" className="min-w-5 justify-center px-1.5 py-0 text-[0.625rem] leading-5 tabular-nums">{count}</Badge>;
}
