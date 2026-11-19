import { publicProfileSchema, type PublicProfile } from "@croebet/shared";

export type ProfileResult =
  | { status: "ready"; profile: PublicProfile }
  | { status: "not-found" }
  | { status: "unavailable" };

export async function loadProfile(
  username: string,
  apiUrl: string,
  request: typeof fetch = fetch,
): Promise<ProfileResult> {
  try {
    const response = await request(`${apiUrl}/api/v1/profiles/${encodeURIComponent(username)}`, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    if (response.status === 404) return { status: "not-found" };
    if (!response.ok) return { status: "unavailable" };
    return { status: "ready", profile: publicProfileSchema.parse(await response.json()) };
  } catch {
    return { status: "unavailable" };
  }
}
