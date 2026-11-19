"use client";

import { preload } from "react-dom";
import { AvatarImage } from "@/components/ui/avatar";
import { useDemoSession } from "@/features/auth/session-context";

export function AccountAvatarImage({ name, src }: { name: string; src?: string | null }) {
  const { username, avatar } = useDemoSession();
  const image = username?.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR") ? avatar : src;
  if (image) preload(image, { as: "image" });
  return image ? <AvatarImage src={image} alt="" /> : null;
}
