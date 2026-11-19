"use client";

import { Icon } from "lucide-react";
import { lucideIconNodes } from "@croebet/shared/lucide-icon-nodes";
import type { IconName } from "@croebet/shared";
import { cn } from "@/lib/utils";

export default function LucideIcon({ name, className }: { name: IconName; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-flex size-4 shrink-0 items-center justify-center [&>svg]:size-full", className)}>
    <Icon iconNode={lucideIconNodes[name]} aria-hidden="true" data-icon={name} />
  </span>;
}
