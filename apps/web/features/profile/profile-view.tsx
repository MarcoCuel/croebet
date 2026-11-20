"use client";

import type { PublicProfile } from "@croebet/shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AccountAvatarImage } from "@/features/auth/account-avatar-image";
import { useSession } from "@/features/auth/session-context";
import { AvatarSettings } from "@/features/settings/avatar-settings";
import { ActivityHeatmap } from "@/features/profile/activity-heatmap";

export function ProfileView({ profile }: { profile: PublicProfile }) {
  const { username: currentUsername } = useSession();

  return (
    <section className="mx-auto flex w-full max-w-5xl min-w-0 flex-col items-center py-12 text-center sm:py-16">
      <div className="group/avatar relative">
        <Avatar className="size-24" aria-hidden="true">
          <AccountAvatarImage name={profile.username} src={profile.avatarUrl} />
          <AvatarFallback className="text-3xl">{Array.from(profile.displayName)[0]?.toLocaleUpperCase("pt-BR")}</AvatarFallback>
        </Avatar>
        {currentUsername?.toLowerCase() === profile.username.toLowerCase() && (
          <AvatarSettings variant="profile" />
        )}
      </div>
      <h1 className="mt-5 max-w-full text-2xl font-semibold wrap-anywhere">{profile.displayName}</h1>
      <p className="mt-2 max-w-full text-sm text-muted wrap-anywhere">@{profile.username}</p>
      <ActivityHeatmap key={profile.username} activity={profile.activity} />
    </section>
  );
}
