"use client";

import type { ComponentProps } from "react";
import { normalizeSlug } from "@croebet/shared";
import { Input } from "@/components/ui/input";

export function SlugInput({ value, onValueChange, onBlur, ...props }: Omit<ComponentProps<typeof Input>, "value" | "defaultValue" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
}) {
  return <Input autoCapitalize="none" autoComplete="off" spellCheck={false} {...props}
    value={value} onChange={event => onValueChange(event.target.value)}
    onBlur={event => {
      const normalized = normalizeSlug(event.currentTarget.value);
      if (normalized !== value) onValueChange(normalized);
      onBlur?.(event);
    }} />;
}
