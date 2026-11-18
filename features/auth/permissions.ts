export type SessionPermissions = { canManageSite: boolean };

/** Local development adapter only. Replace with verified server permissions. */
export function demoPermissions(
  username: string | null,
  configuredAdmins: string | undefined,
  development: boolean,
): SessionPermissions {
  const name = username?.trim().toLowerCase();
  const admins =
    configuredAdmins
      ?.split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean) ?? [];
  return {
    canManageSite: Boolean(development && name && admins.includes(name)),
  };
}
