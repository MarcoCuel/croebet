import "server-only";

import { cookies } from "next/headers";
import { loadInitialSession } from "./initial-session";

export async function getInitialSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get("__Host-croebet-session") ?? cookieStore.get("croebet-session");
  return loadInitialSession(
    session ? `${session.name}=${encodeURIComponent(session.value)}` : undefined,
    process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3001",
  );
}
