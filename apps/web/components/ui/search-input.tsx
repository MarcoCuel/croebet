import type { ComponentProps } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = Omit<ComponentProps<typeof Input>, "type">;

export function SearchInput({
  className,
  "aria-label": label = "Buscar",
  ...props
}: SearchInputProps) {
  return (
    <div data-slot="search-input" className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <Input
        {...props}
        type="search"
        aria-label={label}
        className={cn(
          "rounded-panel pl-10",
          className,
        )}
      />
    </div>
  );
}
