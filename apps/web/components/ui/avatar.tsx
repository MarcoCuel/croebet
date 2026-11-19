"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import Image from "next/image";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Avatar({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className,
      )}
      {...props}
    />
  );
}

type AvatarImageProps = Omit<ComponentProps<typeof Image>, "src" | "alt"> & {
  src?: string;
  alt?: string;
};

export function AvatarImage({ src, alt = "", ...props }: AvatarImageProps) {
  return src ? <RenderedAvatarImage key={src} src={src} alt={alt} {...props} /> : null;
}

function RenderedAvatarImage({ className, onError, alt, ...props }: AvatarImageProps & { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <Image
      {...props}
      alt={alt}
      unoptimized
      loading="eager"
      width={props.width ?? 256}
      height={props.height ?? 256}
      data-slot="avatar-image"
      data-avatar-visible={!failed}
      className={cn("peer size-full object-cover", className, failed && "hidden")}
      onError={event => { setFailed(true); onError?.(event); }}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "grid size-full place-items-center rounded-[inherit] bg-contrast/10 text-xs font-semibold inset-shadow-primary-button peer-data-[avatar-visible=true]:hidden",
        className,
      )}
      {...props}
    />
  );
}
