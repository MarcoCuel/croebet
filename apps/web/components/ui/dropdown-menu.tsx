"use client";

import { ChevronRight, Check } from "lucide-react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownMenuGroup = DropdownPrimitive.Group;
export const DropdownMenuSub = DropdownPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownPrimitive.RadioGroup;

const itemClassName =
  "relative flex min-h-8 cursor-pointer items-center gap-2 rounded-lg border-(length:--border-width-hairline) border-transparent px-2 py-1 text-xs text-foreground outline-none data-highlighted:bg-contrast/10 data-disabled:pointer-events-none data-disabled:opacity-50";

export function DropdownMenuSubTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownPrimitive.SubTrigger>) {
  return (
    <DropdownPrimitive.SubTrigger
      data-slot="dropdown-menu-item"
      className={cn(itemClassName, "data-[state=open]:bg-contrast/10 data-[state=open]:text-foreground", className)}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto size-3" aria-hidden="true" />
    </DropdownPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof DropdownPrimitive.SubContent>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.SubContent
        className={cn("z-50 min-w-36 max-w-[calc(100vw-2rem)] rounded-panel border-(length:--border-width-hairline) border-foreground/10 bg-surface p-1 text-foreground shadow-lg outline-none", className)}
        sideOffset={sideOffset}
        data-lenis-prevent
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownPrimitive.RadioItem>) {
  return (
    <DropdownPrimitive.RadioItem
      data-slot="dropdown-menu-item"
      className={cn(itemClassName, "justify-between gap-4 text-xs", className)}
      {...props}
    >
      {children}
      <span className="size-4">
        <DropdownPrimitive.ItemIndicator>
          <Check className="size-4" aria-hidden="true" />
        </DropdownPrimitive.ItemIndicator>
      </span>
    </DropdownPrimitive.RadioItem>
  );
}

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Content>) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-44 max-w-[calc(100vw-2rem)] rounded-panel border-(length:--border-width-hairline) border-foreground/10 bg-surface p-1 text-foreground shadow-lg outline-none",
          className,
        )}
        data-lenis-prevent
        {...props}
      />
    </DropdownPrimitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Item>) {
  return (
    <DropdownPrimitive.Item
      data-slot="dropdown-menu-item"
      className={cn(
        itemClassName,
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Label>) {
  return (
    <DropdownPrimitive.Label
      data-slot="dropdown-menu-label"
      className={cn("px-3 py-2 text-sm text-muted", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownPrimitive.Separator>) {
  return (
    <DropdownPrimitive.Separator
      className={cn("mx-2 my-1 h-(--border-width-hairline) bg-foreground/10", className)}
      {...props}
    />
  );
}
