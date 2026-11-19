"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({
  className,
  disabled,
  ...props
}: Omit<ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div data-slot="password-input" className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("pr-12", className)}
      />
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-1/2 right-0 -translate-y-1/2 rounded-lg"
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-controls={props.id}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
      >
        <Icon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
