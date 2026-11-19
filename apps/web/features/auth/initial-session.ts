import { sessionSchema, type PublicUser } from "@croebet/shared";

export type InitialSession = { user: PublicUser | null; ready: boolean };

// Only this projection crosses the Server/Client Component boundary, never cookies.
export async function loadInitialSession(
  sessionCookie: string | undefined,
  apiUrl: string,
  request: typeof fetch = fetch,
): Promise<InitialSession> {
  if (!sessionCookie) return { user: null, ready: true };
  try {
    const response = await request(`${apiUrl}/api/v1/me`, {
      headers: { cookie: sessionCookie },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return { user: null, ready: false };
    const { user } = sessionSchema.parse(await response.json());
    return { user, ready: true };
  } catch {
    // An unavailable API cannot confirm that the visitor is signed out.
    return { user: null, ready: false };
  }
}
