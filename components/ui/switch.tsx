import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type SwitchProps = Omit<ComponentProps<"input">, "type" | "role" | "onChange"> & {
  onCheckedChange?: (checked: boolean) => void;
};

export function Switch({ className, disabled, onCheckedChange, ...props }: SwitchProps) {
  return <span className={cn("relative inline-flex min-h-11 w-10 shrink-0 items-center", disabled && "opacity-50", className)}>
    <input {...props} type="checkbox" role="switch" disabled={disabled}
      onChange={event => onCheckedChange?.(event.target.checked)}
      className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
    <span aria-hidden="true" className="pointer-events-none flex h-5.5 w-10 items-center rounded-full border border-transparent bg-field p-0.5 transition-colors motion-reduce:transition-none peer-checked:bg-brand peer-focus-visible:border-foreground peer-checked:[&>span]:translate-x-4.5">
      <span className="size-4 shrink-0 rounded-full bg-white shadow-sm transition-transform duration-200 motion-reduce:transition-none" />
    </span>
  </span>;
}
