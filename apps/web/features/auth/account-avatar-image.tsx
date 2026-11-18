"use client";

import { AvatarImage } from "@/components/ui/avatar";
import { useDemoSession } from "@/features/auth/session-context";

export function AccountAvatarImage({ name }: { name: string }) {
  const { username, avatar } = useDemoSession();
  return avatar && username?.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR")
    ? <AvatarImage src={avatar} alt="" />
    : null;
}
